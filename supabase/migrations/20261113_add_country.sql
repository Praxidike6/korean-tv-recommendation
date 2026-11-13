BEGIN;

ALTER TABLE public.korean_shows
  ADD COLUMN IF NOT EXISTS country text;

COMMIT;
