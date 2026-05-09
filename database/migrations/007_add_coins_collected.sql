-- Add coins_collected column to match_players table
ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS coins_collected INTEGER DEFAULT 0 NOT NULL;
