export enum EventType {
  USER_LOGIN = 'user_login',
  ROOM_CREATED = 'room_created',
  ROOM_JOINED = 'room_joined',
  TEAM_SELECTED = 'team_selected',
  RACE_STARTED = 'race_started',
  RACE_COMPLETED = 'race_completed',
  LAP_COMPLETED = 'lap_completed',
  LEADERBOARD_VIEWED = 'leaderboard_viewed',
  ADMIN_ACTION = 'admin_action',
}

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  userId: string | null;
  eventType: EventType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AnalyticsEventRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
