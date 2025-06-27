-- Migration: Create tables for static team and venue data

-- Table: venues
-- Stores information about MLB stadiums/venues
CREATE TABLE public.venues (
    id BIGINT PRIMARY KEY, -- From MLB API venues[0].id
    name TEXT, -- From MLB API venues[0].name
    
    -- Location details from venues[0].location
    postal_code VARCHAR(20), 
    elevation INTEGER,
    
    -- Field information from venues[0].fieldInfo
    roof_type TEXT,
    field_left_line INTEGER,
    field_left_center INTEGER,
    field_center INTEGER,
    field_right_center INTEGER,
    field_right_line INTEGER,
    
    active BOOLEAN, -- From MLB API venues[0].active
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.venues IS 'Stores information about MLB stadiums/venues.';
COMMENT ON COLUMN public.venues.id IS 'Unique identifier for the venue from MLB API (venues[0].id).';
COMMENT ON COLUMN public.venues.name IS 'Full name of the venue (venues[0].name).';
COMMENT ON COLUMN public.venues.postal_code IS 'Postal code of the venue location (venues[0].location.postalCode).';
COMMENT ON COLUMN public.venues.elevation IS 'Elevation of the venue in feet (venues[0].location.elevation).';
COMMENT ON COLUMN public.venues.roof_type IS 'Type of roof at the venue (venues[0].fieldInfo.roofType).';
COMMENT ON COLUMN public.venues.field_left_line IS 'Distance to the left field foul pole in feet (venues[0].fieldInfo.leftLine).';
COMMENT ON COLUMN public.venues.field_left_center IS 'Distance to left-center field in feet (venues[0].fieldInfo.leftCenter).';
COMMENT ON COLUMN public.venues.field_center IS 'Distance to center field in feet (venues[0].fieldInfo.center).';
COMMENT ON COLUMN public.venues.field_right_center IS 'Distance to right-center field in feet (venues[0].fieldInfo.rightCenter).';
COMMENT ON COLUMN public.venues.field_right_line IS 'Distance to the right field foul pole in feet (venues[0].fieldInfo.rightLine).';
COMMENT ON COLUMN public.venues.active IS 'Indicates if the venue is currently active (venues[0].active).';


-- Table: teams
-- Stores information about MLB teams
CREATE TABLE public.teams (
    id BIGINT PRIMARY KEY, -- From MLB API teams[0].id
    name TEXT NOT NULL, -- Full team name, e.g., "Chicago Cubs" (teams[0].name)
    abbreviation VARCHAR(10) UNIQUE, -- Official team abbreviation, e.g., "CHC" (teams[0].abbreviation)
    nickname TEXT, -- Short team name, e.g., "Cubs" (teams[0].teamName)
    short_name TEXT, -- Another short version of team name, e.g., "Chi Cubs" (teams[0].shortName)
    location_name TEXT, -- City or location name, e.g., "Chicago" (teams[0].locationName)
    
    venue_id BIGINT, -- Foreign key to venues.id (teams[0].venue.id)
    venue_name_cache TEXT, -- Cached venue name for quick reference (teams[0].venue.name)
    
    league_id INTEGER, -- (teams[0].league.id)
    league_name TEXT, -- (teams[0].league.name)
    division_id INTEGER, -- (teams[0].division.id)
    division_name TEXT, -- (teams[0].division.name)
    
    active BOOLEAN, -- From MLB API teams[0].active
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_venue
        FOREIGN KEY(venue_id) 
        REFERENCES public.venues(id)
        ON DELETE SET NULL -- Or ON DELETE RESTRICT if a team must always have a venue
);

COMMENT ON TABLE public.teams IS 'Stores information about MLB teams.';
COMMENT ON COLUMN public.teams.id IS 'Unique identifier for the team from MLB API (teams[0].id).';
COMMENT ON COLUMN public.teams.name IS 'Full official name of the team (teams[0].name).';
COMMENT ON COLUMN public.teams.abbreviation IS 'Official team abbreviation (teams[0].abbreviation).';
COMMENT ON COLUMN public.teams.nickname IS 'Commonly used short name or mascot name for the team (teams[0].teamName).';
COMMENT ON COLUMN public.teams.short_name IS 'A shortened version of the team name (teams[0].shortName).';
COMMENT ON COLUMN public.teams.location_name IS 'The location/city name associated with the team (teams[0].locationName).';
COMMENT ON COLUMN public.teams.venue_id IS 'Foreign key referencing the primary venue of the team.';
COMMENT ON COLUMN public.teams.venue_name_cache IS 'Cached name of the primary venue, for convenience.';
COMMENT ON COLUMN public.teams.league_id IS 'Identifier for the league the team belongs to (teams[0].league.id).';
COMMENT ON COLUMN public.teams.league_name IS 'Name of the league (teams[0].league.name).';
COMMENT ON COLUMN public.teams.division_id IS 'Identifier for the division the team belongs to (teams[0].division.id).';
COMMENT ON COLUMN public.teams.division_name IS 'Name of the division (teams[0].division.name).';
COMMENT ON COLUMN public.teams.active IS 'Indicates if the team is currently active (teams[0].active).';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_abbreviation ON public.teams(abbreviation);
CREATE INDEX IF NOT EXISTS idx_teams_venue_id ON public.teams(venue_id);
CREATE INDEX IF NOT EXISTS idx_venues_name ON public.venues(name);

-- Table: games
-- Stores key information about individual MLB games
CREATE TABLE public.games (
    game_pk BIGINT PRIMARY KEY, -- From MLB API games[0].gamePk
    official_date DATE NOT NULL, -- From MLB API games[0].officialDate (YYYY-MM-DD)
    game_datetime_utc TIMESTAMPTZ, -- From MLB API games[0].gameDate (UTC timestamp)
    detailed_state VARCHAR(50), -- From MLB API games[0].status.detailedState
    
    away_team_id BIGINT, -- From MLB API games[0].teams.away.team.id
    home_team_id BIGINT, -- From MLB API games[0].teams.home.team.id
    venue_id BIGINT, -- From MLB API games[0].venue.id

    away_batting_order BIGINT[], -- Array of player_ids for the away team's batting order
    home_batting_order BIGINT[], -- Array of player_ids for the home team's batting order
    
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_games_away_team
        FOREIGN KEY(away_team_id) REFERENCES public.teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_games_home_team
        FOREIGN KEY(home_team_id) REFERENCES public.teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_games_venue
        FOREIGN KEY(venue_id) REFERENCES public.venues(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.games IS 'Stores key information about individual MLB games.';
COMMENT ON COLUMN public.games.game_pk IS 'Unique identifier for the game from MLB API (games[0].gamePk).';
COMMENT ON COLUMN public.games.official_date IS 'The official date of the game (games[0].officialDate).';
COMMENT ON COLUMN public.games.game_datetime_utc IS 'The precise date and time of the game in UTC (games[0].gameDate).';
COMMENT ON COLUMN public.games.detailed_state IS 'Detailed status of the game, e.g., "Warmup", "Pre-Game", "Final" (games[0].status.detailedState).';
COMMENT ON COLUMN public.games.away_team_id IS 'Identifier for the away team, references teams.id.';
COMMENT ON COLUMN public.games.home_team_id IS 'Identifier for the home team, references teams.id.';
COMMENT ON COLUMN public.games.venue_id IS 'Identifier for the venue where the game is played, references venues.id.';
COMMENT ON COLUMN public.games.away_batting_order IS 'Array of player_ids representing the away team batting order, from liveData.boxscore.teams.away.battingOrder.';
COMMENT ON COLUMN public.games.home_batting_order IS 'Array of player_ids representing the home team batting order, from liveData.boxscore.teams.home.battingOrder.';

CREATE INDEX IF NOT EXISTS idx_games_official_date ON public.games(official_date);
CREATE INDEX IF NOT EXISTS idx_games_home_team_id ON public.games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id ON public.games(away_team_id);