import { supabase } from '../../lib/supabaseClient';
import { EventType } from '../types/event.types';

export { EventType };

export const trackEvent = (
  eventType: EventType,
  userId: string,
  tenantId: string,
  metadata: Record<string, unknown>
): void => {
  void (async (): Promise<void> => {
    try {
      await supabase.from('events').insert({
        event_type: eventType,
        user_id: userId,
        tenant_id: tenantId,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        console.warn('Analytics event failed silently:', error.message);
      }
    }
  })();
};
