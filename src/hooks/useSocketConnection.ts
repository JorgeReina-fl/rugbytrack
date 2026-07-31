"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket";

export interface UseSocketConnectionOptions {
  query?: Record<string, string>;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface UseSocketConnectionReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
}

function resolveWsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export function useSocketConnection(
  options: UseSocketConnectionOptions = {}
): UseSocketConnectionReturn {
  const { query = {}, reconnectionAttempts = 5, reconnectionDelay = 1000 } = options;

  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  // Stable key so the effect only re-runs when query params actually change
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    const wsUrl = resolveWsUrl();
    if (!wsUrl) return;

    const socket = io(wsUrl, {
      query,
      withCredentials: true,
      transports: ["websocket"],
      reconnectionAttempts,
      reconnectionDelay,
    });

    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reconnectionAttempts, reconnectionDelay]);

  return { socket: socketRef.current, connected };
}
