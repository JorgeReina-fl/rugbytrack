"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocketConnection } from "./useSocketConnection";

export function useLiveSocket(eventId: string) {
  const [sessionActive, setSessionActive] = useState(false);
  const joinedRef = useRef(false);

  const { socket, connected } = useSocketConnection({
    query: { eventId },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Emit join_session once per connection and subscribe to domain events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      if (!joinedRef.current) {
        socket.emit("join_session", { eventId });
        joinedRef.current = true;
      }
    };

    const handleDisconnect = () => {
      joinedRef.current = false;
    };

    const handleSessionStatus = ({ active }: { active: boolean }) => {
      setSessionActive(active);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("session_status_change", handleSessionStatus);

    // If already connected when effect runs, join immediately
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("session_status_change", handleSessionStatus);
    };
  }, [socket, eventId]);

  const checkIn = useCallback(() => {
    socket?.emit("check_in", { eventId });
  }, [socket, eventId]);

  return { socket, connected, sessionActive, checkIn };
}
