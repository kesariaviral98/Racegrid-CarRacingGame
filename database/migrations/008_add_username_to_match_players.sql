-- Add username column so player names are stored directly without needing a profiles JOIN
ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS username TEXT;
