-- 001_create_tables.sql

-- Table: player_splits
-- 1. ENUM types for clarity and constraint
CREATE TYPE public.split_player_type AS ENUM ('batter','pitcher');
CREATE TYPE public.hand AS ENUM ('L','R');

-- 2. Player_splits table
CREATE TABLE public.player_splits (
  player_id            BIGINT             NOT NULL,
  season               SMALLINT           NOT NULL,
  player_type          public.split_player_type NOT NULL,
  vs_handedness        public.hand        NOT NULL,
  
  player_name           TEXT,      -- from Savant CSV for easy lookup
  pa                    INTEGER,   -- Plate appearances
  ab                    INTEGER,   -- At‐bats
  ba                    NUMERIC(4,3), -- Batting average
  obp                   NUMERIC(4,3), -- On‐base percentage
  slg                   NUMERIC(4,3), -- Slugging %
  woba                  NUMERIC(4,3), -- Measured wOBA
  xwoba                 NUMERIC(4,3), -- Expected wOBA
  xba                   NUMERIC(4,3), -- Expected BA
  xobp                  NUMERIC(4,3), -- Expected OBP (if available)
  xslg                  NUMERIC(4,3), -- Expected SLG (if available)
  
  iso                   NUMERIC(4,3), -- Isolated power
  babip                 NUMERIC(4,3), -- BABIP
  
  barrels               INTEGER,   -- total barrels
  barrels_per_pa        NUMERIC(7,4), -- barrels / PA
  hard_hit_pct          NUMERIC(5,4), -- % of batted balls ≧ 95 mph
  avg_exit_velocity     NUMERIC(6,2), -- average EV (mph)
  max_exit_velocity     NUMERIC(6,2), -- max EV (mph)
  
  avg_launch_angle      NUMERIC(5,2), -- average launch angle
  groundball_pct        NUMERIC(5,4), -- ground‐ball rate
  line_drive_pct        NUMERIC(5,4), -- line‐drive rate
  flyball_pct           NUMERIC(5,4), -- fly‐ball rate
  
  last_updated          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  
  CONSTRAINT player_splits_pkey
    PRIMARY KEY (player_id, season, player_type, vs_handedness)
);

-- 3. Indexes to speed common lookups
CREATE INDEX IF NOT EXISTS idx_player_splits_player
  ON public.player_splits (player_id);

CREATE INDEX IF NOT EXISTS idx_player_splits_type_hand
  ON public.player_splits (player_type, vs_handedness);



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
  pitcher_name  TEXT,               -- Optional for display
  PRIMARY KEY (game_date, batter_id, pitcher_id)
);

-- Indexes on daily_matchups to speed up queries by date or score
CREATE INDEX IF NOT EXISTS idx_matchups_date
  ON daily_matchups(game_date);

CREATE INDEX IF NOT EXISTS idx_matchups_score_desc
  ON daily_matchups(avg_xwoba DESC);