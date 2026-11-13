BEGIN;

ALTER TABLE public.korean_shows
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'TV Shows',
  ADD COLUMN IF NOT EXISTS personal_rating integer;

ALTER TABLE public.korean_shows
  DROP CONSTRAINT IF EXISTS korean_shows_personal_rating_check;

ALTER TABLE public.korean_shows
  ADD CONSTRAINT korean_shows_personal_rating_check
  CHECK (personal_rating IS NULL OR personal_rating BETWEEN 1 AND 10);

COMMIT;
