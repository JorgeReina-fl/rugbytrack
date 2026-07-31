"use client";

import { useSocketConnection } from "./useSocketConnection";

export function useSocket(eventId?: string, teamId?: string) {
  const query: Record<string, string> = {};
  if (eventId) query.eventId = eventId;
  if (teamId) query.teamId = teamId;

  return useSocketConnection({ query });
}
