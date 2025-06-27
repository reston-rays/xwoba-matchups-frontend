-- 002_add_lineup_info_to_matchup.sql

-- Table: daily_matchups
CREATE TABLE IF NOT EXISTS daily_matchups (
  game_date     DATE     NOT NULL,  -- Date of the games
  batter_id     BIGINT   NOT NULL,  -- MLBAM ID for batter
  pitcher_id    BIGINT   NOT NULL,  -- MLBAM ID for pitcher
  avg_xwoba     REAL     NOT NULL,  -- Average of the two xwOBA values
  avg_launch_angle     REAL     NOT NULL,  -- Average of the two launch angles
  avg_barrels_per_pa REAL NOT NULL,  -- Average of the two barrels per PA
  avg_hard_hit_pct REAL NOT NULL,  -- Average of the two hard-hit percentages
  avg_exit_velocity REAL NOT NULL,  -- Average of the two exit velocities
  batter_name   TEXT,               -- Optional for display
  batter_team  TEXT,               -- Optional for display
  pitcher_name  TEXT,               -- Optional for display
  pitcher_team TEXT,               -- Optional for display
  game_pk VARCHAR(255), -- Unique identifier for the game from the MLB Stats API
  game_home_team_abbreviation VARCHAR(10), -- Abbreviation for the home team of the game
  game_away_team_abbreviation VARCHAR(10), -- Abbreviation for the away team of the game
  PRIMARY KEY (game_date, batter_id, pitcher_id)
);

ALTER TABLE daily_matchups
    ADD COLUMN game_pk VARCHAR(255), -- Or BIGINT if gamePk is always numeric and large
    ADD COLUMN game_home_team_abbreviation VARCHAR(10),
    ADD COLUMN game_away_team_abbreviation VARCHAR(10);

    COMMENT ON COLUMN public.daily_matchups.game_pk IS 'Unique identifier for the game from the MLB Stats API.';
    COMMENT ON COLUMN public.daily_matchups.game_home_team_abbreviation IS 'Abbreviation for the home team of the game.';
    COMMENT ON COLUMN public.daily_matchups.game_away_team_abbreviation IS 'Abbreviation for the away team of the game.';


-- Indexes on daily_matchups to speed up queries by date or score
CREATE INDEX IF NOT EXISTS idx_matchups_date
  ON daily_matchups(game_date);

CREATE INDEX IF NOT EXISTS idx_matchups_score_desc
  ON daily_matchups(avg_xwoba DESC);