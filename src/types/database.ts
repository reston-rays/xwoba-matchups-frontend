/**
 * Represents the structure of the 'venues' table in the database.
 * Corresponds to data from MLB API endpoint: venues
 */
export interface Venue {
  id: number; // Unique identifier for the venue from MLB API (venues[0].id).
  name: string | null; // Full name of the venue (venues[0].name).
  city: string | null; // City where the venue is located (venues[0].location.city).
  state: string | null; // State or province where the venue is located (venues[0].location.stateAbbrev or venues[0].location.state).
  postal_code: string | null; // Postal code of the venue location (venues[0].location.postalCode).
  elevation: number | null; // Elevation of the venue in feet (venues[0].location.elevation).
  latitude: number | null; // Latitude of the venue (venues[0].location.defaultCoordinates.latitude).
  longitude: number | null; // Longitude of the venue (venues[0].location.defaultCoordinates.longitude).
  roof_type: string | null; // Type of roof at the venue (venues[0].fieldInfo.roofType).
  field_left_line: number | null; // Distance to the left field foul pole in feet (venues[0].fieldInfo.leftLine).
  field_left_center: number | null; // Distance to left-center field in feet (venues[0].fieldInfo.leftCenter).
  field_center: number | null; // Distance to center field in feet (venues[0].fieldInfo.center).
  field_right_center: number | null; // Distance to right-center field in feet (venues[0].fieldInfo.rightCenter).
  field_right_line: number | null; // Distance to the right field foul pole in feet (venues[0].fieldInfo.rightLine).
  active: boolean | null; // Indicates if the venue is currently active (venues[0].active).
  last_updated: string; // TIMESTAMPTZ. Timestamp of the last update.
}

/**
 * Represents the structure of the 'teams' table in the database.
 * Corresponds to data from MLB API endpoint: teams
 */
export interface Team {
  id: number; // BIGINT, Primary Key. From MLB API teams[0].id
  name: string; // TEXT. From MLB API teams[0].name
  venue_id: number; // BIGINT, Foreign Key references venues.id. From MLB API teams[0].venue.id
  venue_name_cache: string | null; // TEXT, Nullable. Cached name of the primary venue.
  abbreviation: string; // TEXT. From MLB API teams[0].abbreviation
  nickname: string; // TEXT. Commonly used short name or mascot name (from MLB API teams[0].teamName).
  location_name: string; // TEXT. From MLB API teams[0].locationName
  league_id: number; // BIGINT. From MLB API teams[0].league.id
  league_name: string; // TEXT. Name of the league (from MLB API teams[0].league.name).
  division_id: number; // BIGINT. From MLB API teams[0].division.id
  division_name: string; // TEXT. Name of the division (from MLB API teams[0].division.name).
  short_name: string; // TEXT. From MLB API teams[0].shortName
  active: boolean; // BOOLEAN. From MLB API teams[0].active
  last_updated: string; // TIMESTAMPTZ. Timestamp of the last update.
}

/**
 * Represents the structure of the 'games' table in the database.
 * Corresponds to data from MLB API endpoint: schedule (games array)
 * and game feed (liveData.boxscore)
 */
export interface Game {
  game_pk: number; // Unique identifier for the game from MLB API (games[0].gamePk).
  official_date: string; // The official date of the game (games[0].officialDate).
  game_datetime_utc: string; // The precise date and time of the game in UTC (games[0].gameDate).
  detailed_state: string; // Detailed status of the game, e.g., "Warmup", "Pre-Game", "Final" (games[0].status.detailedState).

  away_team_id: number; // Identifier for the away team, references teams.id.
  home_team_id: number; // Identifier for the home team, references teams.id.
  venue_id: number; // Identifier for the venue where the game is played, references venues.id.

  // Batting orders from liveData.boxscore.teams.[away/home].battingOrder
  // These are arrays of player_ids (BIGINT in DB)
  away_batting_order: number[] | null; // Array of player_ids representing the away team batting order, from liveData.boxscore.teams.away.battingOrder.
  home_batting_order: number[] | null; // Array of player_ids representing the home team batting order, from liveData.boxscore.teams.home.battingOrder.

  away_team_probable_pitcher_id?: number | null; // Nullable BIGINT. ID of the away team's probable pitcher, if available.
  home_team_probable_pitcher_id?: number | null; // Nullable BIGINT. ID of the home team's probable pitcher, if available

  last_updated: string; // TIMESTAMPTZ. Timestamp of the last update.

  // Optional fields that might be populated from games[0].teams.away/home if needed,
  // but primary data comes from team_id linking to the 'teams' table.
  // For example, scores could be added here if we decide to store them directly on the game record.
  // away_score?: number; // From games[0].teams.away.score
  // home_score?: number; // From games[0].teams.home.score
  // away_is_winner?: boolean; // From games[0].teams.away.isWinner
  // home_is_winner?: boolean; // From games[0].teams.home.isWinner
}

/**
 * Represents the structure of the 'players' table in the database.
 * Corresponds to data from MLB API endpoint: /api/v1/teams/{teamId}/roster?hydrate=person (person object)
 */
export interface Player {
  player_id: number; // INTEGER, Primary Key. From MLB API person.id.
  full_name: string; // TEXT. From MLB API person.fullName.
  current_age: number | null; // INTEGER, Nullable. From MLB API person.currentAge.
  height: string | null; // VARCHAR(10), Nullable. From MLB API person.height (e.g., "6' 4\"").
  weight: number | null; // INTEGER, Nullable. From MLB API person.weight.
  primary_position_name: string | null; // VARCHAR(255) or VARCHAR(50), Nullable. From MLB API person.primaryPosition.name.
  primary_position_abbreviation: string | null; // VARCHAR(10), Nullable. From MLB API person.primaryPosition.abbreviation.
  bat_side_code: string | null; // VARCHAR(1), Nullable. From MLB API person.batSide.code (e.g., 'R', 'L', 'S').
  pitch_hand_code: string | null; // VARCHAR(1), Nullable. From MLB API person.pitchHand.code (e.g., 'R', 'L').
  created_at: string; // TIMESTAMPTZ. Timestamp of when the player record was created.
  updated_at: string; // TIMESTAMPTZ. Timestamp of when the player record was last updated.
}

// Note: The Player interface in player.types.ts (PlayerSplit, Matchup) serves a different purpose,
// representing processed or specific views of player data, not a direct table mapping.

/**
 * Represents the structure of the 'player_splits' table in the database.
 * This table stores player statistics for specific seasons, player types (batter/pitcher),
 * and against specific handedness of opponents.
 */
export interface PlayerSplit {
  player_id: number; // bigint, Part of composite Primary Key
  season: number; // smallint, Part of composite Primary Key
  player_type: 'batter' | 'pitcher'; // public.split_player_type, Part of composite Primary Key
  vs_handedness: 'L' | 'R'; // public.hand, Part of composite Primary Key
  player_name: string | null; // text, Nullable
  pa: number | null; // integer, Nullable
  ab: number | null; // integer, Nullable
  ba: number | null; // numeric(4, 3), Nullable
  obp: number | null; // numeric(4, 3), Nullable
  slg: number | null; // numeric(4, 3), Nullable
  woba: number | null; // numeric(4, 3), Nullable
  xwoba: number | null; // numeric(4, 3), Nullable
  xba: number | null; // numeric(4, 3), Nullable
  xobp: number | null; // numeric(4, 3), Nullable
  xslg: number | null; // numeric(4, 3), Nullable
  iso: number | null; // numeric(4, 3), Nullable
  babip: number | null; // numeric(4, 3), Nullable
  barrels: number | null; // integer, Nullable
  barrels_per_pa: number | null; // numeric(7, 4), Nullable
  hard_hit_pct: number | null; // numeric(5, 4), Nullable
  avg_exit_velocity: number | null; // numeric(6, 2), Nullable
  max_exit_velocity: number | null; // numeric(6, 2), Nullable
  avg_launch_angle: number | null; // numeric(5, 2), Nullable
  groundball_pct: number | null; // numeric(5, 4), Nullable
  line_drive_pct: number | null; // numeric(5, 4), Nullable
  flyball_pct: number | null; // numeric(5, 4), Nullable
  last_updated: string; // timestamp with time zone, Not Null, Default now()
  hrs: number | null; // integer, Nullable
  swing_miss_percent: number | null; // numeric(5, 4), Nullable
  hyper_speed: number | null; // numeric(4, 1), Nullable
}

export interface Matchup  {
  game_date: string; // From daily_matchups.game_date (date not null)
  batter_id: number; // From daily_matchups.batter_id (bigint not null)
  pitcher_id: number; // From daily_matchups.pitcher_id (bigint not null)
  avg_xwoba: number; // From daily_matchups.avg_xwoba (real not null)
  avg_launch_angle: number; // From daily_matchups.avg_launch_angle (real not null)
  avg_barrels_per_pa: number; // From daily_matchups.avg_barrels_per_pa (real not null)
  avg_hard_hit_pct: number; // From daily_matchups.avg_hard_hit_pct (real not null)
  avg_exit_velocity: number; // From daily_matchups.avg_exit_velocity (real not null)
  batter_name: string | null; // From daily_matchups.batter_name (text null)
  pitcher_name: string | null; // From daily_matchups.pitcher_name (text null)
  lineup_position: number | null; // Optional field for lineup position
  batter_team: string | null; // From daily_matchups.batter_team (text null)
  pitcher_team: string | null; // From daily_matchups.pitcher_team (text null)
  game_pk: number | null; // From daily_matchups.game_pk (bigint null)
  game_home_team_abbreviation: string | null; // From daily_matchups.game_home_team_abbreviation (varchar(10) null)
  game_away_team_abbreviation: string | null; // From daily_matchups.game_away_team_abbreviation (varchar(10) null)
  pitcher_hand: 'L' | 'R' | null; // From daily_matchups.pitcher_hand (text null)
  batter_hand: 'L' | 'R' | 'S' | null; // From daily_matchups.batter_hand (text null)
}