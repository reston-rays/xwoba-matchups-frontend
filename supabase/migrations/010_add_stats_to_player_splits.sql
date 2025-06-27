-- Migration script to add new statistical columns to the player_splits table

ALTER TABLE IF EXISTS player_splits
ADD COLUMN IF NOT EXISTS hrs INTEGER,
ADD COLUMN IF NOT EXISTS iso NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS swing_miss_percent NUMERIC(5, 4), -- e.g., 0.2550 for 25.5%
ADD COLUMN IF NOT EXISTS hyper_speed NUMERIC(4, 1); -- Adjusted Exit Velocity

COMMENT ON COLUMN player_splits.hrs IS 'Number of home runs.';
COMMENT ON COLUMN player_splits.iso IS 'Isolated Power (SLG - BA). Typically 3 decimal places.';
COMMENT ON COLUMN player_splits.swing_miss_percent IS 'Swing and miss percentage (Whiff %). Stored as a decimal (e.g., 0.2550 for 25.5%).';
COMMENT ON COLUMN player_splits.hyper_speed IS 'Adjusted Exit Velocity (Hyper Speed) in mph. Typically 1 decimal place.';

-- Note: After running this migration, you might want to update your
-- 'update-savant-csvs-to-supabase.ts' script to populate these new columns
-- and your PlayerSplit type definition in 'player.types.ts'.
