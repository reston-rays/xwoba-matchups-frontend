-- Add foreign keys
ALTER TABLE public.daily_matchups
  ADD CONSTRAINT fk_dm_batter FOREIGN KEY (batter_id) REFERENCES public.players(player_id),
  ADD CONSTRAINT fk_dm_pitcher FOREIGN KEY (pitcher_id) REFERENCES public.players(player_id),
  ADD CONSTRAINT fk_dm_game FOREIGN KEY (game_pk) REFERENCES public.games(game_pk);

-- Add check constraints
ALTER TABLE public.daily_matchups
  ADD CONSTRAINT chk_handedness 
  CHECK (
    (pitcher_hand IS NULL OR pitcher_hand IN ('L', 'R')) AND
    (batter_hand IS NULL OR batter_hand IN ('L', 'R', 'S'))
  );

-- Add composite index
CREATE INDEX IF NOT EXISTS idx_matchups_game_date_xwoba 
ON public.daily_matchups (game_date, avg_xwoba DESC) 
WHERE game_pk IS NOT NULL;

-- Add partial indexes
CREATE INDEX IF NOT EXISTS idx_teams_active ON public.teams(id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_venues_active ON public.venues(id) WHERE active = true;