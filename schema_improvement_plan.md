### Plan: Database Schema Improvement for `xwoba-matchups-frontend`

**Goal:** Clean up the database schema, improve consistency, and ensure data integrity where appropriate, while respecting the existing design choices for `daily_matchups`.

**Status:** Proposed - Awaiting Review

---

### Phase 0: Current Schema Extraction

1.  **Link Supabase Project:** Before dumping the schema, we need to link the local Supabase CLI to your remote project.
    *   **Action:** Run `npx supabase link --project-ref fkproqapfunjosherufo` (using your project ID).
    *   **Output:** Confirmation that the project is linked.

2.  **Dump Current Schema:** I will use `npx supabase db dump` to extract the complete current schema of your remote Supabase database. This will provide the most accurate representation of your existing tables, columns, constraints, and functions.
    *   **Prerequisite:** Docker must be running and your user must have permissions to access the Docker daemon. If you encounter a 'permission denied' error, run `sudo usermod -aG docker $USER` and then log out and log back in (or restart your system).
    *   **Action:** Run `npx supabase db dump > supabase/current_schema.sql`
    *   **Output:** The current schema will be saved to `xwoba-matchups-frontend/supabase/current_schema.sql`.

### Phase 1: Initial Assessment & Detailed Analysis

1.  **Review Dumped Schema:** I will analyze the `supabase/current_schema.sql` file to confirm all observations regarding data types, column definitions, and existing constraints. This will be the definitive source for our understanding.
2.  **Identify Inconsistencies:** Specifically, I will confirm:
    *   The exact data type of `players.player_id`.
    *   The final structure of `daily_matchups` after all previous migrations.
    *   The presence of `player_name` in `player_splits`.
    *   The timestamp columns across all tables.

### Phase 2: Refactoring and New Migrations

This phase involves creating new, well-defined migrations to address the identified issues. Each step will result in a new migration file.

1.  **Consolidate `daily_matchups` Schema:**
    *   **Problem:** The `daily_matchups` table has a fragmented creation history across multiple migration files (`001_create_tables.sql`, `003_add_game_data_to_matchup.sql`).
    *   **Solution:** Create a *new* migration that contains the complete and final `CREATE TABLE` statement for `daily_matchups`, incorporating all columns and constraints that have been added over time. This effectively "resets" its definition in the migration history for clarity.
    *   **Action:** Create a new migration file (e.g., `017_consolidate_daily_matchups.sql`) with the full `CREATE TABLE` statement.
    *   **Important Note:** If you have existing data in `daily_matchups` in your production environment, applying this migration will require careful data migration (e.g., backing up data, dropping the table, recreating it, and restoring data). For development, a `supabase db reset` might be sufficient, but we need to be aware of this implication.

2.  **Standardize `player_id` to `BIGINT`:**
    *   **Problem:** `player_id` is `INTEGER` in `players` but `BIGINT` in `player_splits` and `daily_matchups`.
    *   **Solution:** Change `players.player_id` to `BIGINT`.
    *   **Action:** Create a new migration (e.g., `018_alter_player_id_to_bigint.sql`) with `ALTER TABLE players ALTER COLUMN player_id TYPE BIGINT;`.

3.  **Add Foreign Key from `player_splits` to `players`:**
    *   **Problem:** `player_splits` lacks a foreign key to the `players` table, which is a core relationship.
    *   **Solution:** Add a foreign key constraint.
    *   **Action:** Create a new migration (e.g., `019_add_fk_to_player_splits.sql`) with `ALTER TABLE player_splits ADD CONSTRAINT fk_player_splits_player FOREIGN KEY (player_id) REFERENCES players(player_id);`.

4.  **Remove Redundant `player_name` from `player_splits`:**
    *   **Problem:** `player_splits.player_name` is redundant as player names should be sourced from the `players` table.
    *   **Solution:** Drop the redundant column.
    *   **Action:** Create a new migration (e.g., `020_drop_player_name_from_splits.sql`) with `ALTER TABLE player_splits DROP COLUMN player_name;`.

5.  **Standardize Timestamp Columns and Triggers:**
    *   **Problem:** Inconsistent timestamp columns (`last_updated` vs. `created_at`/`updated_at`) and missing `updated_at` triggers on some tables.
    *   **Solution:** Implement `created_at` and `updated_at` with triggers for `player_splits`, `venues`, `teams`, and `games`.
    *   **Action:** For each of these tables, create a separate migration (e.g., `021_standardize_timestamps_player_splits.sql`, `022_standardize_timestamps_venues.sql`, etc.) that:
        *   Adds `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
        *   Adds `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
        *   Creates a trigger to update `updated_at` on `UPDATE`.
        *   Drops the `last_updated` column.
        *   *(Note: The `players` table already has this setup, so it will be excluded from this step.)*

6.  **Review and Potentially Remove Denormalized Columns from `daily_matchups` (Optional, for later discussion):**
    *   **Problem:** `daily_matchups` contains denormalized columns (`batter_name`, `pitcher_name`, `game_home_team_abbreviation`, `game_away_team_abbreviation`, `home_team_id`, `away_team_id`).
    *   **Discussion Point:** While these improve query performance for display, they introduce redundancy. We can decide to remove them and rely on joins to the `players`, `teams`, and `games` tables.
    *   **Action:** This step will *not* be executed now. We will discuss this after the initial cleanup is complete.

### Phase 3: Verification and Testing

1.  **Generate `supabase db diff`:** Before applying any changes, I will generate a `db diff` to see the exact SQL statements that Supabase will execute based on our new migrations. This is a critical review step.
    *   **Action:** Run `npx supabase db diff`
    *   **Review:** We will review the output together to ensure it matches our expectations.
2.  **Apply Migrations to Development:** Once the `db diff` is approved, I will apply the new migrations to your development Supabase instance.
    *   **Action:** Run `npx supabase db push`
3.  **Update TypeScript Types:** After the schema is updated, regenerate the TypeScript types for your application.
    *   **Action:** Run `npm run sync-types`
4.  **Thorough Application Testing:** You will need to thoroughly test your data ingestion pipelines and application logic against the updated schema to ensure everything functions correctly and no regressions have been introduced.
