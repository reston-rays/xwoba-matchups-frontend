


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."hand" AS ENUM (
    'L',
    'R'
);


ALTER TYPE "public"."hand" OWNER TO "postgres";


CREATE TYPE "public"."split_player_type" AS ENUM (
    'batter',
    'pitcher'
);


ALTER TYPE "public"."split_player_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_matchups" (
    "game_date" "date" NOT NULL,
    "batter_id" bigint NOT NULL,
    "pitcher_id" bigint NOT NULL,
    "avg_xwoba" real NOT NULL,
    "avg_launch_angle" real NOT NULL,
    "avg_barrels_per_pa" real NOT NULL,
    "avg_hard_hit_pct" real NOT NULL,
    "avg_exit_velocity" real NOT NULL,
    "batter_name" "text",
    "pitcher_name" "text",
    "lineup_position" integer,
    "batter_team" "text",
    "pitcher_team" "text",
    "game_pk" bigint,
    "game_home_team_abbreviation" character varying(10),
    "game_away_team_abbreviation" character varying(10),
    "pitcher_hand" "text",
    "batter_hand" "text",
    "avg_k_percent" double precision,
    "avg_bb_percent" double precision,
    "avg_iso" double precision,
    "avg_swing_miss_percent" double precision,
    "home_team_id" integer,
    "away_team_id" integer,
    "avg_hr_per_pa" numeric(7,4),
    CONSTRAINT "chk_handedness" CHECK (((("pitcher_hand" IS NULL) OR ("pitcher_hand" = ANY (ARRAY['L'::"text", 'R'::"text"]))) AND (("batter_hand" IS NULL) OR ("batter_hand" = ANY (ARRAY['L'::"text", 'R'::"text", 'S'::"text"])))))
);


ALTER TABLE "public"."daily_matchups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."daily_matchups"."lineup_position" IS 'Lineup position of the batter in the game (1-9), NULL if not available or published yet';



COMMENT ON COLUMN "public"."daily_matchups"."game_pk" IS 'Unique identifier for the game from MLB API (games[0].gamePk), now stored as BIGINT.';



COMMENT ON COLUMN "public"."daily_matchups"."game_home_team_abbreviation" IS 'Abbreviation for the home team of the game.';



COMMENT ON COLUMN "public"."daily_matchups"."game_away_team_abbreviation" IS 'Abbreviation for the away team of the game.';



COMMENT ON COLUMN "public"."daily_matchups"."avg_k_percent" IS 'Average strikeout percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.25 for 25%).';



COMMENT ON COLUMN "public"."daily_matchups"."avg_bb_percent" IS 'Average walk percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.10 for 10%).';



COMMENT ON COLUMN "public"."daily_matchups"."avg_iso" IS 'Average Isolated Power for the batter in the context of this matchup. Stored as a decimal (e.g., 0.150).';



COMMENT ON COLUMN "public"."daily_matchups"."avg_swing_miss_percent" IS 'Average swing and miss percentage for the batter in the context of this matchup. Stored as a decimal (e.g., 0.12 for 12%).';



COMMENT ON COLUMN "public"."daily_matchups"."home_team_id" IS 'Identifier for the home team of the game this matchup belongs to. This is denormalized data if your matchups table also has a game_id.';



COMMENT ON COLUMN "public"."daily_matchups"."away_team_id" IS 'Identifier for the away team of the game this matchup belongs to. This is denormalized data if your matchups table also has a game_id.';



COMMENT ON COLUMN "public"."daily_matchups"."avg_hr_per_pa" IS 'Average home runs per plate appearance, stored as a decimal (e.g., 0.05 for 5%). From Savant data.';



CREATE TABLE IF NOT EXISTS "public"."games" (
    "game_pk" bigint NOT NULL,
    "official_date" "date" NOT NULL,
    "game_datetime_utc" timestamp with time zone,
    "detailed_state" character varying(50),
    "away_team_id" bigint,
    "home_team_id" bigint,
    "venue_id" bigint,
    "away_batting_order" bigint[],
    "home_batting_order" bigint[],
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "home_team_probable_pitcher_id" integer,
    "away_team_probable_pitcher_id" integer
);


ALTER TABLE "public"."games" OWNER TO "postgres";


COMMENT ON TABLE "public"."games" IS 'Stores key information about individual MLB games.';



COMMENT ON COLUMN "public"."games"."game_pk" IS 'Unique identifier for the game from MLB API (games[0].gamePk).';



COMMENT ON COLUMN "public"."games"."official_date" IS 'The official date of the game (games[0].officialDate).';



COMMENT ON COLUMN "public"."games"."game_datetime_utc" IS 'The precise date and time of the game in UTC (games[0].gameDate).';



COMMENT ON COLUMN "public"."games"."detailed_state" IS 'Detailed status of the game, e.g., "Warmup", "Pre-Game", "Final" (games[0].status.detailedState).';



COMMENT ON COLUMN "public"."games"."away_team_id" IS 'Identifier for the away team, references teams.id.';



COMMENT ON COLUMN "public"."games"."home_team_id" IS 'Identifier for the home team, references teams.id.';



COMMENT ON COLUMN "public"."games"."venue_id" IS 'Identifier for the venue where the game is played, references venues.id.';



COMMENT ON COLUMN "public"."games"."away_batting_order" IS 'Array of player_ids representing the away team batting order, from liveData.boxscore.teams.away.battingOrder.';



COMMENT ON COLUMN "public"."games"."home_batting_order" IS 'Array of player_ids representing the home team batting order, from liveData.boxscore.teams.home.battingOrder.';



CREATE TABLE IF NOT EXISTS "public"."player_splits" (
    "player_id" bigint NOT NULL,
    "season" smallint NOT NULL,
    "player_type" "public"."split_player_type" NOT NULL,
    "vs_handedness" "public"."hand" NOT NULL,
    "player_name" "text",
    "pa" integer,
    "ab" integer,
    "ba" numeric(4,3),
    "obp" numeric(4,3),
    "slg" numeric(4,3),
    "woba" numeric(4,3),
    "xwoba" numeric(4,3),
    "xba" numeric(4,3),
    "xobp" numeric(4,3),
    "xslg" numeric(4,3),
    "iso" numeric(4,3),
    "babip" numeric(4,3),
    "barrels" integer,
    "barrels_per_pa" numeric(7,4),
    "hard_hit_pct" numeric(5,4),
    "avg_exit_velocity" numeric(6,2),
    "max_exit_velocity" numeric(6,2),
    "avg_launch_angle" numeric(5,2),
    "groundball_pct" numeric(5,4),
    "line_drive_pct" numeric(5,4),
    "flyball_pct" numeric(5,4),
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hrs" integer,
    "swing_miss_percent" numeric(5,4),
    "hyper_speed" numeric(4,1),
    "k_percent" numeric(5,4),
    "bb_percent" numeric(5,4)
);


ALTER TABLE "public"."player_splits" OWNER TO "postgres";


COMMENT ON COLUMN "public"."player_splits"."iso" IS 'Isolated Power (SLG - BA). Typically 3 decimal places.';



COMMENT ON COLUMN "public"."player_splits"."hrs" IS 'Number of home runs.';



COMMENT ON COLUMN "public"."player_splits"."swing_miss_percent" IS 'Swing and miss percentage (Whiff %). Stored as a decimal (e.g., 0.2550 for 25.5%).';



COMMENT ON COLUMN "public"."player_splits"."hyper_speed" IS 'Adjusted Exit Velocity (Hyper Speed) in mph. Typically 1 decimal place.';



COMMENT ON COLUMN "public"."player_splits"."k_percent" IS 'Strikeout percentage, stored as a decimal (e.g., 0.255 for 25.5%). From Savant data.';



COMMENT ON COLUMN "public"."player_splits"."bb_percent" IS 'Walk percentage, stored as a decimal (e.g., 0.085 for 8.5%). From Savant data.';



CREATE TABLE IF NOT EXISTS "public"."players" (
    "player_id" integer NOT NULL,
    "full_name" "text" NOT NULL,
    "current_age" integer,
    "height" character varying(10),
    "weight" integer,
    "primary_position_name" character varying(255),
    "primary_position_abbreviation" character varying(10),
    "bat_side_code" character varying(1),
    "pitch_hand_code" character varying(1),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."players" OWNER TO "postgres";


COMMENT ON TABLE "public"."players" IS 'Stores information about individual MLB players.';



COMMENT ON COLUMN "public"."players"."player_id" IS 'Unique identifier for the player, from MLB Stats API (person.id).';



COMMENT ON COLUMN "public"."players"."full_name" IS 'Full name of the player.';



COMMENT ON COLUMN "public"."players"."current_age" IS 'Current age of the player.';



COMMENT ON COLUMN "public"."players"."height" IS 'Player''s height, typically as a string (e.g., "6'' 4"").';



COMMENT ON COLUMN "public"."players"."weight" IS 'Player''s weight in pounds.';



COMMENT ON COLUMN "public"."players"."primary_position_name" IS 'Name of the player''s primary position (e.g., "Pitcher", "Outfielder").';



COMMENT ON COLUMN "public"."players"."primary_position_abbreviation" IS 'Abbreviation for the player''s primary position (e.g., "P", "RF").';



COMMENT ON COLUMN "public"."players"."bat_side_code" IS 'Player''s batting side: L (Left), R (Right), S (Switch).';



COMMENT ON COLUMN "public"."players"."pitch_hand_code" IS 'Player''s pitching hand: L (Left), R (Right).';



COMMENT ON COLUMN "public"."players"."created_at" IS 'Timestamp of when the player record was created.';



COMMENT ON COLUMN "public"."players"."updated_at" IS 'Timestamp of when the player record was last updated.';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "abbreviation" character varying(10),
    "nickname" "text",
    "short_name" "text",
    "location_name" "text",
    "venue_id" bigint,
    "venue_name_cache" "text",
    "league_id" integer,
    "league_name" "text",
    "division_id" integer,
    "division_name" "text",
    "active" boolean,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Stores information about MLB teams.';



COMMENT ON COLUMN "public"."teams"."id" IS 'Unique identifier for the team from MLB API (teams[0].id).';



COMMENT ON COLUMN "public"."teams"."name" IS 'Full official name of the team (teams[0].name).';



COMMENT ON COLUMN "public"."teams"."abbreviation" IS 'Official team abbreviation (teams[0].abbreviation).';



COMMENT ON COLUMN "public"."teams"."nickname" IS 'Commonly used short name or mascot name for the team (teams[0].teamName).';



COMMENT ON COLUMN "public"."teams"."short_name" IS 'A shortened version of the team name (teams[0].shortName).';



COMMENT ON COLUMN "public"."teams"."location_name" IS 'The location/city name associated with the team (teams[0].locationName).';



COMMENT ON COLUMN "public"."teams"."venue_id" IS 'Foreign key referencing the primary venue of the team.';



COMMENT ON COLUMN "public"."teams"."venue_name_cache" IS 'Cached name of the primary venue, for convenience.';



COMMENT ON COLUMN "public"."teams"."league_id" IS 'Identifier for the league the team belongs to (teams[0].league.id).';



COMMENT ON COLUMN "public"."teams"."league_name" IS 'Name of the league (teams[0].league.name).';



COMMENT ON COLUMN "public"."teams"."division_id" IS 'Identifier for the division the team belongs to (teams[0].division.id).';



COMMENT ON COLUMN "public"."teams"."division_name" IS 'Name of the division (teams[0].division.name).';



COMMENT ON COLUMN "public"."teams"."active" IS 'Indicates if the team is currently active (teams[0].active).';



CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" bigint NOT NULL,
    "name" "text",
    "postal_code" character varying(20),
    "elevation" integer,
    "roof_type" "text",
    "field_left_line" integer,
    "field_left_center" integer,
    "field_center" integer,
    "field_right_center" integer,
    "field_right_line" integer,
    "active" boolean,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "city" "text",
    "state" "text",
    "latitude" numeric(9,6),
    "longitude" numeric(9,6)
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


COMMENT ON TABLE "public"."venues" IS 'Stores information about MLB stadiums/venues.';



COMMENT ON COLUMN "public"."venues"."id" IS 'Unique identifier for the venue from MLB API (venues[0].id).';



COMMENT ON COLUMN "public"."venues"."name" IS 'Full name of the venue (venues[0].name).';



COMMENT ON COLUMN "public"."venues"."postal_code" IS 'Postal code of the venue location (venues[0].location.postalCode).';



COMMENT ON COLUMN "public"."venues"."elevation" IS 'Elevation of the venue in feet (venues[0].location.elevation).';



COMMENT ON COLUMN "public"."venues"."roof_type" IS 'Type of roof at the venue (venues[0].fieldInfo.roofType).';



COMMENT ON COLUMN "public"."venues"."field_left_line" IS 'Distance to the left field foul pole in feet (venues[0].fieldInfo.leftLine).';



COMMENT ON COLUMN "public"."venues"."field_left_center" IS 'Distance to left-center field in feet (venues[0].fieldInfo.leftCenter).';



COMMENT ON COLUMN "public"."venues"."field_center" IS 'Distance to center field in feet (venues[0].fieldInfo.center).';



COMMENT ON COLUMN "public"."venues"."field_right_center" IS 'Distance to right-center field in feet (venues[0].fieldInfo.rightCenter).';



COMMENT ON COLUMN "public"."venues"."field_right_line" IS 'Distance to the right field foul pole in feet (venues[0].fieldInfo.rightLine).';



COMMENT ON COLUMN "public"."venues"."active" IS 'Indicates if the venue is currently active (venues[0].active).';



COMMENT ON COLUMN "public"."venues"."city" IS 'City where the venue is located (venues[0].location.city).';



COMMENT ON COLUMN "public"."venues"."state" IS 'State or province where the venue is located (venues[0].location.stateAbbrev or venues[0].location.state).';



COMMENT ON COLUMN "public"."venues"."latitude" IS 'Latitude of the venue (venues[0].location.defaultCoordinates.latitude).';



COMMENT ON COLUMN "public"."venues"."longitude" IS 'Longitude of the venue (venues[0].location.defaultCoordinates.longitude).';



ALTER TABLE ONLY "public"."daily_matchups"
    ADD CONSTRAINT "daily_matchups_pkey" PRIMARY KEY ("game_date", "batter_id", "pitcher_id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("game_pk");



ALTER TABLE ONLY "public"."player_splits"
    ADD CONSTRAINT "player_splits_pkey" PRIMARY KEY ("player_id", "season", "player_type", "vs_handedness");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("player_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_abbreviation_key" UNIQUE ("abbreviation");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_games_away_team_id" ON "public"."games" USING "btree" ("away_team_id");



CREATE INDEX "idx_games_home_team_id" ON "public"."games" USING "btree" ("home_team_id");



CREATE INDEX "idx_games_official_date" ON "public"."games" USING "btree" ("official_date");



CREATE INDEX "idx_matchups_date" ON "public"."daily_matchups" USING "btree" ("game_date");



CREATE INDEX "idx_matchups_game_date_xwoba" ON "public"."daily_matchups" USING "btree" ("game_date", "avg_xwoba" DESC) WHERE ("game_pk" IS NOT NULL);



CREATE INDEX "idx_matchups_score_desc" ON "public"."daily_matchups" USING "btree" ("avg_xwoba" DESC);



CREATE INDEX "idx_player_splits_player" ON "public"."player_splits" USING "btree" ("player_id");



CREATE INDEX "idx_player_splits_type_hand" ON "public"."player_splits" USING "btree" ("player_type", "vs_handedness");



CREATE INDEX "idx_players_full_name" ON "public"."players" USING "btree" ("full_name");



CREATE INDEX "idx_teams_abbreviation" ON "public"."teams" USING "btree" ("abbreviation");



CREATE INDEX "idx_teams_active" ON "public"."teams" USING "btree" ("id") WHERE ("active" = true);



CREATE INDEX "idx_teams_venue_id" ON "public"."teams" USING "btree" ("venue_id");



CREATE INDEX "idx_venues_active" ON "public"."venues" USING "btree" ("id") WHERE ("active" = true);



CREATE INDEX "idx_venues_name" ON "public"."venues" USING "btree" ("name");



CREATE OR REPLACE TRIGGER "trigger_players_updated_at" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."daily_matchups"
    ADD CONSTRAINT "fk_dm_game" FOREIGN KEY ("game_pk") REFERENCES "public"."games"("game_pk");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "fk_games_away_team" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "fk_games_home_team" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "fk_games_venue" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "fk_venue" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_matchups" TO "anon";
GRANT ALL ON TABLE "public"."daily_matchups" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_matchups" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."player_splits" TO "anon";
GRANT ALL ON TABLE "public"."player_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."player_splits" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
