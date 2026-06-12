"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("@next/env");
// Load environment variables before importing local modules
(0, env_1.loadEnvConfig)(process.cwd());
const prisma_1 = require("./src/lib/prisma");
const logger_1 = require("./src/lib/logger");
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const listenHost = dev ? "127.0.0.1" : "0.0.0.0";
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
function parseCookies(cookieHeader) {
    if (!cookieHeader)
        return {};
    const cookies = {};
    cookieHeader.split(";").forEach((cookie) => {
        var _a;
        const parts = cookie.split("=");
        const name = (_a = parts[0]) === null || _a === void 0 ? void 0 : _a.trim();
        const val = parts.slice(1).join("=").trim();
        if (name) {
            cookies[name] = val;
        }
    });
    return cookies;
}
app.prepare().then(() => {
    const httpServer = (0, http_1.createServer)((req, res) => {
        try {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            handle(req, res, parsedUrl);
        }
        catch (err) {
            logger_1.logger.error(err, "Error handling HTTP request");
            res.statusCode = 500;
            res.end("Internal server error");
        }
    });
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    // Redis Adapter Setup
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error("REDIS_URL environment variable is not defined");
    }
    const pubClient = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    // Secondary client for local redis operations (e.g. key checks)
    const redisLocal = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
    // Redis Subscriber for sync with REST endpoints
    const redisSub = redisLocal.duplicate();
    redisSub.subscribe("session:status", "attendance:update");
    redisSub.on("message", (channel, message) => {
        try {
            const data = JSON.parse(message);
            if (channel === "session:status") {
                io.to(`session:${data.eventId}`).emit("session_status_change", {
                    eventId: data.eventId,
                    active: data.active,
                });
            }
            else if (channel === "attendance:update") {
                io.to(`session:${data.eventId}`).emit("attendance_update", {
                    userId: data.userId,
                    name: data.name,
                    checkedIn: data.checkedIn,
                    checkedInAt: data.checkedInAt,
                    status: data.status,
                });
            }
        }
        catch (err) {
            logger_1.logger.error({ err, channel }, "Error processing Redis subscription message");
        }
    });
    // Authentication Middleware
    io.use(async (socket, nextMiddleware) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie;
            const cookies = parseCookies(cookieHeader);
            const tokenName = cookies["__Host-next-auth.session-token"] ? "__Host-next-auth.session-token" : "next-auth.session-token";
            const token = cookies[tokenName];
            if (!token) {
                return nextMiddleware(new Error("Authentication error: No session token provided"));
            }
            const { decode } = await Promise.resolve().then(() => __importStar(require("next-auth/jwt")));
            const decoded = await decode({
                token,
                secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
                salt: tokenName,
            });
            if (!decoded || !decoded.sub) {
                return nextMiddleware(new Error("Authentication error: Session is invalid or expired"));
            }
            socket.data = { user: { id: decoded.sub, role: decoded.role || "PLAYER", email: decoded.email } };
            nextMiddleware();
        }
        catch (err) {
            logger_1.logger.error(err, "Socket authentication error");
            nextMiddleware(new Error("Authentication error: Server error occurred"));
        }
    });
    io.on("connection", (socket) => {
        logger_1.logger.info({ userId: socket.data.user.id }, "Socket connection established");
        // Scopes client to event room if query contains eventId
        const eventId = socket.handshake.query.eventId;
        if (eventId) {
            socket.join(`session:${eventId}`);
            redisLocal.exists(`session:active:${eventId}`).then((exists) => {
                socket.emit("session_status_change", { eventId, active: exists === 1 });
            }).catch((err) => {
                logger_1.logger.error(err, "Error checking if session active on connect");
            });
        }
        socket.on("join_session", async ({ eventId: roomEventId }) => {
            if (!roomEventId)
                return;
            socket.join(`session:${roomEventId}`);
            try {
                const exists = await redisLocal.exists(`session:active:${roomEventId}`);
                socket.emit("session_status_change", { eventId: roomEventId, active: exists === 1 });
            }
            catch (err) {
                logger_1.logger.error(err, "Error checking if session active on join_session");
            }
        });
        socket.on("check_in", async ({ eventId: checkEventId }) => {
            var _a, _b;
            try {
                const user = socket.data.user;
                const active = await redisLocal.exists(`session:active:${checkEventId}`);
                if (active !== 1) {
                    socket.emit("error", { message: "La sesión de asistencia no está activa" });
                    return;
                }
                const event = await prisma_1.prisma.event.findUnique({
                    where: { id: checkEventId },
                    select: { teamId: true },
                });
                if (!event) {
                    socket.emit("error", { message: "Evento no encontrado" });
                    return;
                }
                const membership = await prisma_1.prisma.teamMember.findFirst({
                    where: { userId: user.id, teamId: event.teamId },
                });
                if (!membership) {
                    socket.emit("error", { message: "No eres miembro de este equipo" });
                    return;
                }
                const attendance = await prisma_1.prisma.attendance.upsert({
                    where: { eventId_userId: { eventId: checkEventId, userId: user.id } },
                    update: { checkedIn: true, checkedInAt: new Date(), status: "CONFIRMED" },
                    create: { eventId: checkEventId, userId: user.id, checkedIn: true, checkedInAt: new Date(), status: "CONFIRMED" },
                    include: { user: { select: { name: true } } },
                });
                io.to(`session:${checkEventId}`).emit("attendance_update", {
                    userId: user.id,
                    name: attendance.user.name,
                    checkedIn: true,
                    checkedInAt: (_b = (_a = attendance.checkedInAt) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null,
                    status: attendance.status,
                });
                logger_1.logger.info({ userId: user.id, eventId: checkEventId }, "Attendance checked in successfully via WebSocket");
            }
            catch (err) {
                logger_1.logger.error(err, "Error performing WebSocket check-in");
                socket.emit("error", { message: "Error interno al marcar asistencia" });
            }
        });
        socket.on("disconnect", () => {
            logger_1.logger.info({ userId: socket.data.user.id }, "Socket connection closed");
        });
    });
    const shutdown = async () => {
        logger_1.logger.info("Shutting down custom server gracefully...");
        io.close();
        await pubClient.quit();
        await subClient.quit();
        await redisSub.quit();
        await redisLocal.quit();
        httpServer.close(() => {
            logger_1.logger.info("Custom server stopped");
            process.exit(0);
        });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    httpServer.listen(port, listenHost, () => {
        logger_1.logger.info(`> Ready on http://${listenHost}:${port}`);
    });
});
