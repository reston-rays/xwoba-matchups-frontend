-- Migration script for creating the PLAYERS table

CREATE TABLE IF NOT EXISTS players (
    player_id INTEGER PRIMARY KEY NOT NULL, -- Corresponds to person.id from the API
    full_name TEXT NOT NULL,                -- Corresponds to person.fullName
    current_age INTEGER,                    -- Corresponds to person.currentAge
    height VARCHAR(10),                     -- Corresponds to person.height (e.g., "6' 4\"")
    weight INTEGER,                         -- Corresponds to person.weight
    primary_position_name VARCHAR(255),     -- Corresponds to person.primaryPosition.name
    primary_position_abbreviation VARCHAR(10), -- Corresponds to person.primaryPosition.abbreviation
    bat_side_code VARCHAR(1),               -- Corresponds to person.batSide.code (e.g., 'R', 'L', 'S')
    pitch_hand_code VARCHAR(1),             -- Corresponds to person.pitchHand.code (e.g., 'R', 'L')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Create an index for faster lookups if you query by full_name frequently
CREATE INDEX IF NOT EXISTS idx_players_full_name ON players (full_name);

-- Optional: Trigger to update 'updated_at' timestamp on row update
-- The exact syntax for triggers can vary slightly depending on your specific SQL database (PostgreSQL, MySQL, etc.)
-- This is a PostgreSQL example:
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_players_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE players IS 'Stores information about individual MLB players.';
COMMENT ON COLUMN players.player_id IS 'Unique identifier for the player, from MLB Stats API (person.id).';
COMMENT ON COLUMN players.full_name IS 'Full name of the player.';
COMMENT ON COLUMN players.current_age IS 'Current age of the player.';
COMMENT ON COLUMN players.height IS 'Player''s height, typically as a string (e.g., "6'' 4""").';
COMMENT ON COLUMN players.weight IS 'Player''s weight in pounds.';
COMMENT ON COLUMN players.primary_position_name IS 'Name of the player''s primary position (e.g., "Pitcher", "Outfielder").';
COMMENT ON COLUMN players.primary_position_abbreviation IS 'Abbreviation for the player''s primary position (e.g., "P", "RF").';
COMMENT ON COLUMN players.bat_side_code IS 'Player''s batting side: L (Left), R (Right), S (Switch).';
COMMENT ON COLUMN players.pitch_hand_code IS 'Player''s pitching hand: L (Left), R (Right).';
COMMENT ON COLUMN players.created_at IS 'Timestamp of when the player record was created.';
COMMENT ON COLUMN players.updated_at IS 'Timestamp of when the player record was last updated.';

