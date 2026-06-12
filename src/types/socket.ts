export interface UserSocketData {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface AttendanceUpdateData {
  userId: string;
  name: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  status: string;
}

export interface SessionStatusChangeData {
  eventId: string;
  active: boolean;
}

export interface SocketErrorData {
  message: string;
}

export interface PollUpdateData {
  teamId: string;
  pollId: string;
  options: { id: string; votesCount: number }[];
}

export interface ServerToClientEvents {
  attendance_update: (data: AttendanceUpdateData) => void;
  session_status_change: (data: SessionStatusChangeData) => void;
  poll_update: (data: PollUpdateData) => void;
  proposal_update: (data: any) => void;
  error: (data: SocketErrorData) => void;
}

export interface ClientToServerEvents {
  join_session: (data: { eventId: string }) => void;
  join_team: (data: { teamId: string }) => void;
  check_in: (data: { eventId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: UserSocketData;
}
