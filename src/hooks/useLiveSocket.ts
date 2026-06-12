"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket";

/**
 * Connects to the Socket.io server scoped to a specific eventId room.
 * Auto-reconnects, cleans up on unmount, and exposes typed socket ref.
 */
export function useLiveSocket(eventId: string) {
  const [connected, setConnected] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    if (!wsUrl) return;

    const socket = io(wsUrl, {
      query: { eventId },
      withCredentials: true,
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_session", { eventId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("session_status_change", ({ active }) => {
      setSessionActive(active);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId]);

  const checkIn = useCallback(() => {
    socketRef.current?.emit("check_in", { eventId });
  }, [eventId]);

  return { socket: socketRef.current, connected, sessionActive, checkIn };
}
