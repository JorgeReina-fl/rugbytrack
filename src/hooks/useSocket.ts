"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";

export function useSocket(eventId?: string, teamId?: string) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    // En desarrollo local o producción, si NEXT_PUBLIC_WS_URL no está definido se autodetecta el origen
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== "undefined" ? window.location.origin : "");

    if (!wsUrl) return;

    const query: Record<string, string> = {};
    if (eventId) query.eventId = eventId;
    if (teamId) query.teamId = teamId;

    const socketInstance = io(wsUrl, {
      query,
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [eventId, teamId]);

  return {
    socket: socketRef.current,
    connected,
  };
}
