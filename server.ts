import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { loadEnvConfig } from "@next/env";

// Load environment variables before importing local modules
loadEnvConfig(process.cwd());

import { prisma } from "./src/lib/prisma";
import { logger } from "./src/lib/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const listenHost = dev ? "127.0.0.1" : "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    const val = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = val;
    }
  });
  return cookies;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      logger.error(err, "Error handling HTTP request");
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  const io = new Server(httpServer, {
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

  const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Secondary client for local redis operations (e.g. key checks)
  const redisLocal = new Redis(redisUrl, { maxRetriesPerRequest: null });

  // Redis Subscriber for sync with REST endpoints
  const redisSub = redisLocal.duplicate();
  redisSub.subscribe("session:status", "attendance:update", "poll:update", "proposal:update");
  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === "session:status") {
        io.to(`session:${data.eventId}`).emit("session_status_change", {
          eventId: data.eventId,
          active: data.active,
        });
      } else if (channel === "attendance:update") {
        io.to(`session:${data.eventId}`).emit("attendance_update", {
          userId: data.userId,
          name: data.name,
          checkedIn: data.checkedIn,
          checkedInAt: data.checkedInAt,
          status: data.status,
        });
      } else if (channel === "poll:update") {
        io.to(`team:${data.teamId}`).emit("poll_update", data);
      } else if (channel === "proposal:update") {
        io.to(`team:${data.teamId}`).emit("proposal_update", data.proposal);
      }
    } catch (err) {
      logger.error({ err, channel }, "Error processing Redis subscription message");
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

      const { decode } = await import("next-auth/jwt");
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
    } catch (err) {
      logger.error(err, "Socket authentication error");
      nextMiddleware(new Error("Authentication error: Server error occurred"));
    }
  });

  io.on("connection", (socket) => {
    logger.info({ userId: socket.data.user.id }, "Socket connection established");

    // Scopes client to event room if query contains eventId
    const eventId = socket.handshake.query.eventId as string;
    if (eventId) {
      socket.join(`session:${eventId}`);
      redisLocal.exists(`session:active:${eventId}`).then((exists) => {
        socket.emit("session_status_change", { eventId, active: exists === 1 });
      }).catch((err) => {
        logger.error(err, "Error checking if session active on connect");
      });
    }

    socket.on("join_session", async ({ eventId: roomEventId }) => {
      if (!roomEventId) return;
      socket.join(`session:${roomEventId}`);
      try {
        const exists = await redisLocal.exists(`session:active:${roomEventId}`);
        socket.emit("session_status_change", { eventId: roomEventId, active: exists === 1 });
      } catch (err) {
        logger.error(err, "Error checking if session active on join_session");
      }
    });

    socket.on("join_team", ({ teamId: roomTeamId }) => {
      if (roomTeamId) socket.join(`team:${roomTeamId}`);
    });

    socket.on("check_in", async ({ eventId: checkEventId }) => {
      try {
        const user = socket.data.user;
        const active = await redisLocal.exists(`session:active:${checkEventId}`);
        if (active !== 1) {
          socket.emit("error", { message: "La sesión de asistencia no está activa" });
          return;
        }

        const event = await prisma.event.findUnique({
          where: { id: checkEventId },
          select: { teamId: true },
        });

        if (!event) {
          socket.emit("error", { message: "Evento no encontrado" });
          return;
        }

        const membership = await prisma.teamMember.findFirst({
          where: { userId: user.id, teamId: event.teamId },
        });

        if (!membership) {
          socket.emit("error", { message: "No eres miembro de este equipo" });
          return;
        }

        const attendance = await prisma.attendance.upsert({
          where: { eventId_userId: { eventId: checkEventId, userId: user.id } },
          update: { checkedIn: true, checkedInAt: new Date(), status: "CONFIRMED" },
          create: { eventId: checkEventId, userId: user.id, checkedIn: true, checkedInAt: new Date(), status: "CONFIRMED" },
          include: { user: { select: { name: true } } },
        });

        io.to(`session:${checkEventId}`).emit("attendance_update", {
          userId: user.id,
          name: attendance.user.name,
          checkedIn: true,
          checkedInAt: attendance.checkedInAt?.toISOString() ?? null,
          status: attendance.status,
        });

        logger.info({ userId: user.id, eventId: checkEventId }, "Attendance checked in successfully via WebSocket");
      } catch (err) {
        logger.error(err, "Error performing WebSocket check-in");
        socket.emit("error", { message: "Error interno al marcar asistencia" });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.data.user.id }, "Socket connection closed");
    });
  });

  const shutdown = async () => {
    logger.info("Shutting down custom server gracefully...");
    io.close();
    await pubClient.quit();
    await subClient.quit();
    await redisSub.quit();
    await redisLocal.quit();
    httpServer.close(() => {
      logger.info("Custom server stopped");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(port, listenHost, () => {
    logger.info(`> Ready on http://${listenHost}:${port}`);
  });
});
