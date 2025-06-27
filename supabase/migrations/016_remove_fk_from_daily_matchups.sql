-- Migration script to remove all foreign key constraints from the daily_matchups table

-- Drop foreign key constraint on batter_id if it exists
ALTER TABLE public.daily_matchups
  DROP CONSTRAINT IF EXISTS fk_dm_batter;

-- Drop foreign key constraint on pitcher_id if it exists
ALTER TABLE public.daily_matchups
  DROP CONSTRAINT IF EXISTS fk_dm_pitcher;