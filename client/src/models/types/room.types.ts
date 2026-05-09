export type RoomStatus = 'waiting' | 'active' | 'finished';
export type TeamId = 'A' | 'B';

export interface RoomPlayer {
  userId: string;
  username: string;
  team: TeamId;
}

export interface Room {
  id: string;
  tenantId: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  createdAt: string;
  players: RoomPlayer[];
}

export interface RoomRow {
  id: string;
  tenant_id: string;
  code: string;
  status: RoomStatus;
  host_id: string;
  created_at: string;
}
