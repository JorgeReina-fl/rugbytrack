"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const isDev = process.env.NODE_ENV === "development";
exports.logger = (0, pino_1.default)(Object.assign(Object.assign({ level: (_a = process.env.LOG_LEVEL) !== null && _a !== void 0 ? _a : (isDev ? "debug" : "info") }, (isDev
    ? {
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
            },
        },
    }
    : {
        formatters: {
            level(label) {
                return { level: label };
            },
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
    })), { redact: {
        paths: [
            "password",
            "passwordHash",
            "*.password",
            "*.passwordHash",
            "token",
            "accessToken",
            "refreshToken",
            "sessionToken",
            "*.token",
            "*.accessToken",
        ],
        censor: "[REDACTED]",
    } }));
