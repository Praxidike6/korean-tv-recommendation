# Public browsing and approved editors

The browser uses only the public Supabase URL and publishable key. Authenticated
users may edit only when their user ID is in `public.watchlist_editors`.
The frontend checks membership for presentation; the database is authoritative.
All watched/downloaded/requested flags are shared by everyone.

## Activate database protection first

1. In Supabase SQL Editor, run `supabase/migrations/20260922_editor_access.sql`.
   It keeps public reads, replaces the existing public-write policies, and
   removes TRUNCATE and other unnecessary grants. No show records are changed.
   Until an editor is approved, all app users have read-only access.
2. In Authentication settings, disable **Allow new users to sign up**.
   Keep the email provider enabled.
3. In Authentication → URL Configuration, set Site URL to
   `https://praxidike6.github.io/korean-tv-recommendation/` and add that exact
   URL to the redirect allowlist.
4. Under Authentication → Users, invite your email address if it is
   not already an app user. The Supabase dashboard account and app users are
   separate identities. Do not share passwords or service keys with the app.
5. After that account exists, run the following SQL to approve it:

```sql
DO $$
DECLARE editor_id uuid;
BEGIN
  SELECT id INTO editor_id FROM auth.users
    WHERE lower(email) = lower('REPLACE_WITH_INVITED_EMAIL');
  IF editor_id IS NULL THEN
    RAISE EXCEPTION 'Invite the user in Authentication > Users first';
  END IF;
  INSERT INTO public.watchlist_editors(user_id) VALUES (editor_id)
    ON CONFLICT (user_id) DO NOTHING;
END $$;
```

6. Deploy `index.html` and `auth.js` together. Accept the invite or use
   **Email me a sign-in link**. There is no public sign-up form and sign-in
   requests set `shouldCreateUser: false`.

Supabase's default mail service may limit recipients to project-team addresses
and rate-limit messages. Configure your own SMTP provider if invitations or
sign-in messages cannot reach invited people. Never put SMTP credentials in
this website or in browser configuration.

## Invite or remove another editor

Invite their email in Authentication → Users, then run the approval SQL above
with their email substituted. Inviting alone does not approve editing.
To revoke editing, delete their row from `watchlist_editors` using the Table
Editor. The database immediately denies subsequent writes, even if a stale
browser still displays editing buttons. Sign out/in refreshes the interface.

## Verification

- Signed out: all shows, search and filters work; editing controls are disabled
  or hidden. Direct writes using just the publishable key must fail.
- Approved account: email link returns to the watchlist and displays Editor.
  Add a uniquely named test show, update its flags, then delete that test show.
- Invited but unapproved account: sign-in works but displays View only; database
  UPDATE/DELETE returns no affected rows and INSERT is denied.
- Sign out: editing disappears and any open edit dialog closes.
- Removal from editor list: subsequent writes fail without changing shows.

Use `node --test tests/access.test.cjs` for local frontend access tests.
Live database and email tests require the dashboard steps above; frontend tests
alone do not prove the deployed database is protected.

## Scheduled database health check

`Supabase health check` runs every six hours on the default branch, at 04:17,
10:17, 16:17 and 22:17 Brisbane time (GitHub may delay scheduled runs).
It reads at most one show name using the existing `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` repository variables. It does not modify data,
use editor credentials, or log show contents. Failed requests fail the workflow.
Run it manually through Actions → Supabase health check → Run workflow.

This is best-effort activity, not a guarantee against Supabase Free plan pausing.
GitHub disables scheduled workflows in public repositories after 60 days without
repository activity. If disabled, re-enable this workflow in Actions. A paused
Supabase project must be restored from its dashboard; this check cannot restore it.
Check your GitHub Actions notification settings if you want failure emails.
