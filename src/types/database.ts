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
 * Represents the structure for player data.
 * This is a placeholder and will be expanded based on the player API.
 * For now, it's used to define the type for batting order arrays.
 */
export interface Player {
    id: number; // Corresponds to player_id in batting_order arrays
    // ... other player properties will be added here
    fullName?: string; // Example from API
    // etc.
}