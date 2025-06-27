-- Migration script to add k_percent and bb_percent to player_splits

ALTER TABLE public.player_splits
ADD COLUMN IF NOT EXISTS avg_hr_per_pa NUMERIC(7, 4) NULL;

COMMENT ON COLUMN public.player_splits.avg_hr_per_pa IS 'Average home runs per plate appearance, stored as a decimal (e.g., 0.05 for 5%). From Savant data.';

