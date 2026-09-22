BEGIN;

CREATE TABLE IF NOT EXISTS public.watchlist_editors (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlist_editors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watchlist_editors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.watchlist_editors TO authenticated;
DROP POLICY IF EXISTS "Editors can check own membership" ON public.watchlist_editors;
CREATE POLICY "Editors can check own membership" ON public.watchlist_editors
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.korean_shows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.korean_shows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.korean_shows TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.korean_shows TO authenticated;

-- Replace existing policies: permissive policies are combined with OR.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'korean_shows'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.korean_shows', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can view shows" ON public.korean_shows
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Approved editors can insert shows" ON public.korean_shows
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.watchlist_editors WHERE user_id = (SELECT auth.uid()))
  );
CREATE POLICY "Approved editors can update shows" ON public.korean_shows
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.watchlist_editors WHERE user_id = (SELECT auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.watchlist_editors WHERE user_id = (SELECT auth.uid()))
  );
CREATE POLICY "Approved editors can delete shows" ON public.korean_shows
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.watchlist_editors WHERE user_id = (SELECT auth.uid()))
  );
COMMIT;
