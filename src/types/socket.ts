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

export interface ServerToClientEvents {
  attendance_update: (data: AttendanceUpdateData) => void;
  session_status_change: (data: SessionStatusChangeData) => void;
  error: (data: SocketErrorData) => void;
}

export interface ClientToServerEvents {
  join_session: (data: { eventId: string }) => void;
  check_in: (data: { eventId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: UserSocketData;
}
