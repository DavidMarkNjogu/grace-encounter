# Grace Encounter Registration Ledger

Dedup + search + admin call-tracking for the Grace Encounter transport
registration list. Next.js 14 (App Router) + Supabase (Postgres, Auth,
Realtime) + Tailwind v4, deployable free on Vercel + Supabase's free tier.

## 1. Create the Supabase project
1. https://supabase.com → New project (free tier is enough for this).
2. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run.
   This creates the tables, RLS policies, the phone-normalization function,
   and the `register_person` RPC. It also seeds two starter pickup points
   ("Nakuru", "Egerton") — rename or add more from the admin Team panel any time.
3. Go to **Authentication → Providers → Email** and make sure "Enable Email
   provider" is on and **"Confirm email"** is OFF (so the magic link logs
   people straight in — no separate signup/confirm step needed for a
   short-lived event tool like this).
4. Go to **Authentication → URL Configuration** and add your eventual Vercel
   URL (e.g. `https://your-app.vercel.app/**`) to **Redirect URLs**, plus
   `http://localhost:3000/**` for local testing.
5. Grab your **Project URL** and **anon public key** from Settings → API.

## 2. Bootstrap the first admin
Before anyone can log in to `/admin`, at least one email needs to exist in
`admin_users` — the RLS policy only lets existing *admin*-role users add
new ones, so the very first one has to be added by hand:

In the Supabase SQL editor, run (replace with your real email):
```sql
insert into admin_users (email, role) values ('you@example.com', 'admin');
```
After that, you can add every other caller/admin from inside the app
(Admin → Team panel) — no more SQL needed.

## 3. Configure environment variables
Copy `.env.example` to `.env.local` (and set the same in Vercel's project
settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from step 1.5.
- `NEXT_PUBLIC_SITE_URL` — your deployed URL (used to build the magic-link
  redirect). Use `http://localhost:3000` while developing locally.
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — optional, from
  posthog.com (free tier). Leave blank to skip analytics.

## 4. Run locally / deploy
```bash
npm install
npm run dev        # http://localhost:3000
```
To deploy: push this folder to a GitHub repo, then "Import Project" on
vercel.com and add the environment variables above. Every push to `main`
redeploys automatically.

## 5. Using it
- **Public page (`/`)**: anyone can search their name/phone, or self-register
  if they're missing. They never see call status — that's admin-only.
- **Import (`/admin` → "Import list")**: paste one or more raw WhatsApp
  message blocks (numbered lists, any of the messy formats seen in the
  group). It previews new / duplicate / unreadable counts before you commit.
  Entries with a list number but no readable phone (e.g. someone wrote a
  student ID instead of a number, or left the number blank) are always
  flagged rather than silently dropped or merged into a neighbor — check
  those by hand.
- **Calling**: filter by status/pickup point, update status and pickup point
  inline per person — changes sync to every open admin tab within ~1-2s.
- **Team (`/admin` → "Team", admins only)**: add a caller/admin by email
  (they'll use magic-link sign-in, no password) and manage pickup points.

## Also in v1 now (previously listed as P1)
- **Possible-duplicate review** (Admin → "Duplicates"): same/near-identical
  name with a *different* phone number is never auto-merged — it's flagged
  for a human to either dismiss ("genuinely two different people") or
  remove the extra entry. Exact phone-number matches remain the only thing
  treated as a hard duplicate automatically.
- **Notes per registrant** ("+ note" on any row) — e.g. "confirming Friday",
  "called twice, no answer".
- **CSV export** (Admin → "Export CSV") — current filtered view.
- **Audit trail** — every status/pickup/note/team/event-info change is
  logged to `admin_actions` (actor email, action, timestamp) for later
  review via SQL; no UI for it yet, but the data's being captured.

## Bugs found and fixed while building this (worth knowing about)
- `normalize_ke_phone` originally accepted some non-phone digit strings as
  valid (e.g. a student registration number like `G11/09644/22` normalized
  to a fake number). Fixed by rejecting any input containing a letter and
  tightening accepted digit patterns to real Kenyan mobile ranges
  (07xx.../011x...) instead of "starts with 7 or 1".
- The realtime publication statement would abort the whole schema script if
  run somewhere `supabase_realtime` doesn't pre-exist; it's now defensive.
- The whole project (schema against real Postgres, and `npm run build`)
  was actually compiled/run to verify this, not just read over.

## Known v1 limitations
- No UI for the audit log yet (data is captured, just query it in Supabase
  directly for now: `select * from admin_actions order by created_at desc`).
- Bulk-import duplicate/possible-duplicate detection runs one entry at a
  time server-side — fine for a few hundred rows, would need batching for
  thousands.
