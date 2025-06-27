-- Sample player_splits for 2024 season
-- seeds/seed.sql
-- Sample seed data for testing frontend
-- Matches revised player_splits schema

INSERT INTO public.player_splits (
  player_id,
  season,
  player_type,
  vs_handedness,
  player_name,

  pa,
  ab,
  ba,
  obp,
  slg,
  woba,
  xwoba,
  xba,
  xobp,
  xslg,
  iso,
  babip,

  barrels,
  barrels_per_pa,
  hard_hit_pct,
  avg_exit_velocity,
  max_exit_velocity,

  avg_launch_angle,
  groundball_pct,
  line_drive_pct,
  flyball_pct,

  last_updated
) VALUES
  -- Mookie Betts vs LHP
  (
    545361, 2024, 'batter', 'L', 'Mookie Betts',
    150, 132, 0.300, 0.400, 0.550, 0.410, 0.385, 0.298, 0.395, 0.540, 0.250, 0.330,
    15, 0.1000, 0.5000, 92.5, 105.0,
    15.00, 0.2500, 0.2000, 0.5500,
    NOW() - INTERVAL '1 day'
  ),
  -- Mookie Betts vs RHP
  (
    545361, 2024, 'batter', 'R', 'Mookie Betts',
    450, 396, 0.280, 0.360, 0.500, 0.370, 0.325, 0.275, 0.365, 0.450, 0.220, 0.340,
    40, 0.0889, 0.4500, 91.0, 103.0,
    12.50, 0.2600, 0.2200, 0.5200,
    NOW() - INTERVAL '1 day'
  ),
  -- Aaron Judge vs LHP
  (
    594798, 2024, 'batter', 'L', 'Aaron Judge',
    180, 160, 0.290, 0.420, 0.600, 0.430, 0.412, 0.305, 0.418, 0.580, 0.310, 0.350,
    25, 0.1389, 0.5500, 95.0, 108.0,
    18.00, 0.2300, 0.1500, 0.6200,
    NOW() - INTERVAL '1 day'
  ),
  -- Aaron Judge vs RHP
  (
    594798, 2024, 'batter', 'R', 'Aaron Judge',
    420, 378, 0.260, 0.370, 0.520, 0.380, 0.305, 0.280, 0.360, 0.460, 0.260, 0.320,
    50, 0.1190, 0.5000, 94.0, 105.0,
    16.00, 0.2600, 0.1800, 0.5500,
    NOW() - INTERVAL '1 day'
  ),
  -- Max Scherzer vs LHB
  (
    660670, 2024, 'pitcher', 'L', 'Max Scherzer',
    230, 210, 0.220, 0.290, 0.380, 0.280, 0.240, 0.210, 0.260, 0.350, 0.160, 0.300,
    5,  0.0217, 0.3000, 88.0, 102.0,
    12.00, 0.4000, 0.2000, 0.4000,
    NOW() - INTERVAL '1 day'
  ),
  -- Max Scherzer vs RHB
  (
    660670, 2024, 'pitcher', 'R', 'Max Scherzer',
    380, 350, 0.240, 0.300, 0.400, 0.300, 0.270, 0.230, 0.280, 0.360, 0.160, 0.320,
    15, 0.0395, 0.3800, 89.0, 103.5,
    11.50, 0.3800, 0.2100, 0.4200,
    NOW() - INTERVAL '1 day'
  ),
  -- Gerrit Cole vs LHB
  (
    701040, 2024, 'pitcher', 'L', 'Gerrit Cole',
    210, 200, 0.210, 0.270, 0.350, 0.270, 0.230, 0.200, 0.260, 0.330, 0.140, 0.280,
    6,  0.0286, 0.3300, 90.0, 104.0,
    13.00, 0.3800, 0.2100, 0.4100,
    NOW() - INTERVAL '1 day'
  ),
  -- Gerrit Cole vs RHB
  (
    701040, 2024, 'pitcher', 'R', 'Gerrit Cole',
    400, 380, 0.230, 0.280, 0.380, 0.290, 0.260, 0.220, 0.300, 0.360, 0.150, 0.310,
    18, 0.0450, 0.3600, 91.0, 105.0,
    14.00, 0.3500, 0.2300, 0.4200,
    NOW() - INTERVAL '1 day'
  );

-- Sample daily_matchups seed data for 2025-05-12

INSERT INTO public.daily_matchups (
  game_date,
  batter_id,
  pitcher_id,

  avg_xwoba,
  avg_launch_angle,
  avg_barrels_per_pa,
  avg_hard_hit_pct,
  avg_exit_velocity,

  batter_name,
  pitcher_name
) VALUES
  -- Mookie Betts vs Max Scherzer (Sch. is LHP)
  (
    '2025-05-12',
    545361, 
    660670,
    (0.385 + 0.240) / 2,  -- avg_xwoba = 0.3125
    (15.00 + 10.00) / 2, -- avg_launch_angle = 12.50
    (0.1000 + 0.0417) / 2, -- avg_barrels_per_pa ≃ 0.07085
    (0.5000 + 0.3500) / 2, -- avg_hard_hit_pct = 0.4250
    (92.5   + 88.0  ) / 2, -- avg_exit_velocity = 90.25
    'Mookie Betts',
    'Max Scherzer'
  ),
  -- Aaron Judge vs Max Scherzer (Sch. is RHP)
  (
    '2025-05-12',
    594798,
    660670,
    (0.412 + 0.270) / 2,  -- avg_xwoba = 0.3410
    (18.00 + 11.00) / 2, -- avg_launch_angle = 14.50
    (0.1389 + 0.0395) / 2, -- avg_barrels_per_pa ≃ 0.0892
    (0.5500 + 0.3800) / 2, -- avg_hard_hit_pct = 0.4650
    (95.0   + 89.0  ) / 2, -- avg_exit_velocity = 92.00
    'Aaron Judge',
    'Max Scherzer'
  ),
  -- Mookie Betts vs Gerrit Cole (Cole is LHP)
  (
    '2025-05-12',
    545361,
    701040,
    (0.325 + 0.230) / 2,  -- avg_xwoba = 0.2775
    (12.50 + 12.00) / 2, -- avg_launch_angle = 12.25
    (0.0889 + 0.0400) / 2, -- avg_barrels_per_pa ≃ 0.06445
    (0.4500 + 0.3300) / 2, -- avg_hard_hit_pct = 0.3900
    (91.0   + 90.0  ) / 2, -- avg_exit_velocity = 90.50
    'Mookie Betts',
    'Gerrit Cole'
  ),
  -- Aaron Judge vs Gerrit Cole (Cole is RHP)
  (
    '2025-05-12',
    594798,
    701040,
    (0.412 + 0.260) / 2,  -- avg_xwoba = 0.3360
    (18.00 + 13.00) / 2, -- avg_launch_angle = 15.50
    (0.1389 + 0.0450) / 2, -- avg_barrels_per_pa = 0.09195
    (0.5500 + 0.3600) / 2, -- avg_hard_hit_pct = 0.4550
    (95.0   + 91.0  ) / 2, -- avg_exit_velocity = 93.00
    'Aaron Judge',
    'Gerrit Cole'
  );