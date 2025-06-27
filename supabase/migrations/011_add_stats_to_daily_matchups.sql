-- Migration script to add new columns to the Matchups table

-- Add average K % (strikeout percentage)
-- Stores the value as a decimal, e.g., 0.25 for 25%
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS avg_k_percent DOUBLE PRECISION;

-- Add average BB % (walk percentage)
-- Stores the value as a decimal, e.g., 0.10 for 10%
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS avg_bb_percent DOUBLE PRECISION;

-- Add average ISO (Isolated Power)
-- Stores the value as a decimal, e.g., 0.150
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS avg_iso DOUBLE PRECISION;

-- Add average Swing Miss %
-- Stores the value as a decimal, e.g., 0.12 for 12%
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS avg_swing_miss_percent DOUBLE PRECISION;

-- Add Home Team ID
-- Assumes team IDs are integers. If they are strings (e.g., 'NYA', 'BOS'),
-- you might want to use TEXT or VARCHAR(3) instead of INTEGER.
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS home_team_id INTEGER;

-- Add Away Team ID
-- Assumes team IDs are integers. If they are strings (e.g., 'NYA', 'BOS'),
-- you might want to use TEXT or VARCHAR(3) instead of INTEGER.
ALTER TABLE public.daily_matchups
ADD COLUMN IF NOT EXISTS away_team_id INTEGER;

-- Optional: Add comments to describe the new columns for better schema understanding
COMMENT ON COLUMN public.daily_matchups.avg_k_percent IS 'Average strikeout percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.25 for 25%).';
COMMENT ON COLUMN public.daily_matchups.avg_bb_percent IS 'Average walk percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.10 for 10%).';
COMMENT ON COLUMN public.daily_matchups.avg_iso IS 'Average Isolated Power for the batter in the context of this matchup. Stored as a decimal (e.g., 0.150).';
COMMENT ON COLUMN public.daily_matchups.avg_swing_miss_percent IS 'Average swing and miss percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.12 for 12%).';
COMMENT ON COLUMN public.daily_matchups.home_team_id IS 'Identifier for the home team of the game this matchup belongs to. This is denormalized data if your matchups table also has a game_id.';
COMMENT ON COLUMN public.daily_matchups.away_team_id IS 'Identifier for the away team of the game this matchup belongs to. This is denormalized data if your matchups table also has a game_id.';

