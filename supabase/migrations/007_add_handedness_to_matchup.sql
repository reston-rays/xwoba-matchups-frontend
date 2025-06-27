-- /workspaces/xwoba-matchups-frontend/infra/supabase/migrations/006_fix_gamepk_type_in_matchups.sql

-- Before running this migration, ensure that all existing values in 
-- daily_matchups.game_pk can be safely cast to BIGINT.
-- You can check for problematic values with a query like:
-- SELECT game_pk FROM public.daily_matchups WHERE game_pk !~ '^\d+$';
-- If any non-integer strings exist, they must be cleaned or removed first.

ALTER TABLE public.daily_matchups
ADD COLUMN pitcher_hand TEXT,
ADD COLUMN batter_hand TEXT;


COMMENT ON COLUMN public.daily_matchups.game_pk IS 'Unique identifier for the game from MLB API (games[0].gamePk), now stored as BIGINT.';

-- Optional: If you have an index on game_pk and its type was varchar,
-- it might be implicitly handled, but you could explicitly recreate it if needed.
-- Example: DROP INDEX IF EXISTS idx_daily_matchups_game_pk_varchar; (if you had one)
-- CREATE INDEX IF NOT EXISTS idx_daily_matchups_game_pk ON public.daily_matchups (game_pk);
