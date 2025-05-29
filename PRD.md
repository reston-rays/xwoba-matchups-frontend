# xwOBA Matchups — Product Requirements Document

## 1. Overview

**Goal**
Help fantasy/baseball-stat fans discover, each morning, the highest-impact hitter-pitcher matchups using xwOBA and related Statcast metrics.

**MVP**

* Daily ingest of yesterday’s (or specified date’s) games
* Compute per–batter/pitcher “avg\_xwoba” (plus launch-angle, barrels/PA, hard-hit %, EV) matchups
* Expose a simple API and Next.js front end to:

  * Show top 20 overall matchups
  * Show matchups grouped by game, with published batting orders if available, otherwise full active roster

## 2. Tech Stack

* **Front-end**: Next.js (App Router, React 18)
* **Back-end & Database**: Supabase (PostgreSQL, PostgREST, Edge Functions)
* **Hosting**: Vercel (free tier) for front end, Supabase free tier for database
* **CI/CD**: GitHub Actions + `supabase db push` + Vercel GitHub integration

## 3. Data Sources

1. **Statcast Historical Splits** (via Savant CSVs) → `player_splits`
2. **MLB Stats API**

   * `/schedule?date=…&hydrate=probablePitcher` → games + probables
   * `/game/{gamePk}/boxscore` → published batting orders
   * Fallback: roster endpoints if lineup missing
3. **Supabase** stores both static splits and dynamic daily matchups

## 4. Data Model

### 4.1 `player_splits`

| Column                                                                 | Type                          | Notes                                       |
| ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------------- |
| `player_id`                                                            | `BIGINT` PK (not null)        | MLBAM player ID                             |
| `season`                                                               | `SMALLINT` PK (not null)      | Year (0 = weighted all-seasons)             |
| `player_type`                                                          | `TEXT` PK (not null)          | `'batter'` or `'pitcher'`                   |
| `vs_handedness`                                                        | `CHAR(1)` PK (not null)       | `'L'`, `'R'`, or `'S'` (for switch hitters) |
| **– rate metrics –**                                                   |                               |                                             |
| `pa`                                                                   | `INT`                         | Plate Appearances                           |
| `ab`                                                                   | `INT`                         | At Bats                                     |
| `ba`,`obp`,`slg`                                                       | `REAL`                        | Traditional rates                           |
| `woba`,`xwoba`,`xba`,…                                                 | `REAL`                        | wOBA/xwOBA and related                      |
| **– batted-ball –**                                                    |                               |                                             |
| `barrels`,`barrels_per_pa`,<br>`hard_hit_pct`<br>`avg_exit_velocity`,… | `REAL`                        | Statcast batted-ball metrics                |
| **– ballistic metrics –**                                              |                               |                                             |
| `avg_launch_angle`,`groundball_pct`,`ld_pct`,`fb_pct`                  | `REAL`                        | Distribution of batted balls                |
| `last_updated`                                                         | `TIMESTAMPTZ` default `now()` | When this split row was inserted/updated    |

Primary key: `(player_id, season, player_type, vs_handedness)`
Indexes: on `player_id`; on `(player_type, vs_handedness)`

### 4.2 `daily_matchups`

| Column                                                                         | Type                          | Notes                                                        |
| ------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------ |
| `game_date`                                                                    | `DATE` PK (not null)          | OfficialDate of games                                        |
| `game_pk`                                                                      | `BIGINT` PK (not null)        | Unique MLB game identifier                                   |
| `game_home_team_abbreviation`                                                  | `TEXT`                        | e.g. “NYY”                                                   |
| `game_away_team_abbreviation`                                                  | `TEXT`                        |                                                              |
| **batter vs pitcher info**                                                     |                               |                                                              |
| `batter_id`,`pitcher_id`                                                       | `BIGINT`                      |                                                              |
| `batter_name`,`pitcher_name`                                                   | `TEXT`                        |                                                              |
| `batter_team`,`pitcher_team`                                                   | `TEXT`                        | Abbreviations only                                           |
| `lineup_position`                                                              | `SMALLINT`                    | 1–9 if from published lineup; `NULL` if fallback roster used |
| `batter_hand`,`pitcher_hand`                                                   | `CHAR(1)`                     | ‘L’/‘R’/‘S’                                                  |
| **– averaged Statcast metrics –**                                              |                               |                                                              |
| `avg_xwoba`                                                                    | `REAL`                        | = avg(pitcher.xwoba vs this hand, batter.xwoba vs that hand) |
| `avg_launch_angle`,`avg_barrels_per_pa`,`avg_hard_hit_pct`,`avg_exit_velocity` | `REAL`                        | same pattern                                                 |
| **– audit –**                                                                  |                               |                                                              |
| `inserted_at`                                                                  | `TIMESTAMPTZ` default `now()` |                                                              |

Primary key: `(game_date, game_pk, batter_id, pitcher_id)`
Index on `(game_pk)`

## 5. Ingest Pipeline

1. **Schedule Fetch**

   * GET `/schedule?date=YYYY-MM-DD&sportId=1&hydrate=probablePitcher`
   * Log count, sample game for debugging
2. **Boxscore Hydration**

   * For each `gamePk`, GET `/game/{gamePk}/boxscore` → extract `battingOrder` arrays
3. **Roster Fallback**

   * If no published `battingOrder`, filter `daily_matchups` by `batter_team = game_*_team_abbreviation`
4. **Lookup Pair Generation**

   * For each lineup (or full roster), pair each `batter_id` with the opposing probable-pitcher
   * Capture `lineup_position` when from published order
5. **Fetch Splits**

   * Batch-fetch `season = 0` sentinel rows from `player_splits` for all unique player IDs (≤ 1000 per query)
   * Map into lookup map by `(player_type, player_id, vs_handedness)`
6. **Fetch Handedness**

   * GET `/people?personIds=…` → build `batMap`/`pitMap`
7. **Compute Matchup Averages**

   * For each lookup pair:

     * Determine effective handedness for switch hitters
     * Pull pitcher and batter split rows
     * Compute each averaged metric
     * Push an object into `upserts[]`
8. **Upsert** → `supabase.from('daily_matchups').upsert(upserts)`

## 6. API Endpoints

### GET `/api/matchups?date=YYYY-MM-DD`

Returns JSON array of `GamesWithMatchupsAndVenues`:

```ts
interface GamesWithMatchupsAndVenues {
  game_date: string;
  game_pk: number;
  game_home_team_abbreviation: string;
  game_away_team_abbreviation: string;
  detailed_state: string;
  game_datetime_utc: string;
  venue?: { name: string; city: string; /*…*/ };
  home_team_probable_pitcher_id?: number;
  away_team_probable_pitcher_id?: number;
  home_pitcher_details?: { name: string; hand: 'L'|'R' } | null;
  away_pitcher_details?: { name: string; hand: 'L'|'R' } | null;
  away_team_matchups: Matchup[];   // each has line-specific stats
  home_team_matchups: Matchup[];
}

interface Matchup {
  game_pk: number;
  batter_id: number;
  batter_name: string;
  batter_team: string;
  lineup_position: number | null;
  batter_hand: 'L'|'R'|'S';
  pitcher_id: number;
  pitcher_name: string;
  pitcher_team: string;
  pitcher_hand: 'L'|'R';
  avg_xwoba: number;
  avg_launch_angle: number;
  avg_barrels_per_pa: number;
  avg_hard_hit_pct: number;
  avg_exit_velocity: number;
}
```

### GET `/api/ingest?date=…&debug=true`

Runs one ingest cycle returning `{ success: true, count: N, logs: […] }`.

## 7. Front-end

* **Top 20 Overall**: flatten all matchups and sort by `avg_xwoba`
* **By-Game View**: loop over `games`, rendering two tables per game:

  * Away batters vs home pitcher
  * Home batters vs away pitcher
* **Date selector** with max = today (UTC shifted to PT)
* **Responsive** tables, hide less-critical columns on small screens

## 8. Weighted All-Seasons (“season 0”)

* After per-season splits (e.g. 2023–2025), load them into `player_splits`
* Run this once to populate **season 0** (all-seasons) using recency×PA weighting:

  ```sql
  INSERT INTO player_splits (player_id,season,player_type,vs_handedness,
    pa,ab,ba,obp,slg,woba,xwoba,xba,xobp,xslg,iso,babip,
    barrels,barrels_per_pa,hard_hit_pct,avg_exit_velocity,max_exit_velocity,
    avg_launch_angle,groundball_pct,line_drive_pct,flyball_pct
  )
  WITH recency AS (
    SELECT 2025 AS season,0.50 AS w UNION ALL
    SELECT 2024,0.30      UNION ALL
    SELECT 2023,0.20
  ), data AS (
    SELECT * FROM player_splits WHERE season IN (2025,2024,2023)
  )
  SELECT
    d.player_id, 0, d.player_type, d.vs_handedness,
    SUM(d.pa),SUM(d.ab),
    SUM(d.ba*d.ab)/SUM(d.ab),
    SUM(d.obp*d.pa)/SUM(d.pa),
    … etc …
  FROM data d
  JOIN recency r USING(season)
  GROUP BY d.player_id,d.player_type,d.vs_handedness;
  ```

## 9. Non-Functional

* **Performance**: Cold‐start ingest can take several seconds; OK for MVP
* **Reliability**: No RLS for now; public read; service role upserts
* **Scalability**: Batching for splits queries; paged to 1 000-row PostgREST limit
* **Security**: Vercel & Supabase secrets stored as GitHub Actions secrets

---