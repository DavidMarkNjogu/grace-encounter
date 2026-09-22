# PRD: Grace Encounter Registration Ledger

## Problem Statement
The "GRACE OUTPOST" WhatsApp group runs free-transport registration for Grace Encounter (Nairobi, Sept 26–27, 2026) by having each new person copy-paste the last message and append their name/number. This breaks constantly: people copy stale/partial versions of the list, causing dropped entries; manually scanning 500+ lines to catch duplicates or find one person is slow and error-prone; and the organizers calling registrants have no shared, live view of who's confirmed, pending, or unreachable — so people get called twice or missed. The cost is real: people who registered may be left without transport, and admin time is wasted untangling WhatsApp text.

## Goals
1. Ingest raw pasted WhatsApp list text and produce a deduplicated, canonical registrant list with >99% dedup accuracy on phone number as the identity key.
2. Let any registrant (or admin) find/verify their entry via real-time search in under 2 seconds, from a phone.
3. Give admins a shared, live (cross-device, real-time sync) view of call status and pickup point per registrant, with role-gated access.
4. Ship a usable v1 within hours, on infrastructure that costs $0 up to a few thousand registrants.
5. Every admin edit (status, pickup point) is visible to all other admins within ~1–2 seconds, no manual refresh.

## Non-Goals (v1)
- No WhatsApp bot/auto-ingestion — paste is manual (real API integration is heavy, out of scope for a same-day build).
- No self-service login for registrants (they don't need accounts; only admins authenticate).
- No SMS/call automation — admins still make calls themselves; the tool only tracks status.
- No multi-event support — this is scoped to one event's list; generalizing comes later if it becomes a template (like Harambee Ledger did).
- No offline-first/PWA support in v1 — assume admins have connectivity; can revisit if venue connectivity is a problem.

## User Stories
**Registrant / general group member**
- As a registrant, I want to search by my name or phone number so I can confirm I'm on the list without scrolling 500 lines.
- As a new person, I want a simple form to add my name and number so I don't have to copy-paste a WhatsApp message correctly.
- As someone whose entry got dropped, I want to re-add myself without creating a duplicate under a different phone format.

**Admin / caller**
- As a caller, I want to filter the list by status (not called / pending / confirmed / tentative) so I only see who I still need to reach.
- As a caller, I want to mark someone confirmed and assign a pickup point right after the call so the record is immediately correct for everyone else.
- As an admin, I want to see if someone is a duplicate before I call them twice.
- As an admin, I want role-gated access so only authorized callers/admins see call-status data — the public/search view stays read-only for everyone else.

**Organizer / super-admin**
- As an organizer, I want to paste in a fresh batch of WhatsApp messages and have new entries merged in with duplicates auto-rejected.
- As an organizer, I want a count of total registrants, confirmed, pending, and by pickup point, at a glance.

## Requirements

### Must-Have (P0)
1. **Bulk ingest**: paste one or more raw WhatsApp message blocks (numbered lists, mixed formats like "Name-0712345678", "Name — +254712345678", "Name_0712345678") → parser extracts name + phone.
   - AC: Given a pasted block with the messy formats seen in the sample data (dashes, underscores, spaces, "Read more" truncation, stylized unicode text), the parser correctly extracts ≥95% of entries without manual cleanup.
2. **Phone normalization + dedup**: normalize all Kenyan formats (07xx, 01xx, +254 7xx, 2547xx, with/without spaces) to a single canonical E.164-style key; reject/merge exact phone duplicates; flag same-name-different-number as "possible duplicate" for human review rather than auto-merging.
   - AC: Two entries with the same phone in different formats are recognized as one record. Two different people with the same first name are NOT merged.
3. **Real-time search**: search box filters/highlights matches by name and/or phone as the user types (debounced), across the full list.
   - AC: Typing partial name or partial phone returns matching results with the match substring highlighted, updating on each keystroke without a page reload.
4. **Self-registration form**: name + phone fields, client + server validation, writes directly into the same canonical store (goes through the same dedup check as bulk import).
5. **Admin auth + RBAC**: at least two roles — Caller (can view/edit status + pickup point) and Admin (Caller rights + can run bulk import, see full stats, manage users). Public users get read-only search, no status data.
6. **Call status tracking**: each record has a status enum — Not Called, Pending, Confirmed, Tentative (confirming last day) — editable by Callers/Admins, with an optional short note.
7. **Pickup point assignment**: each confirmed (or tentative) registrant can be tagged with one of 2–3 defined pickup points; pickup points are configurable by Admin, not hardcoded.
8. **Live cross-device sync**: any status/pickup point/new-registrant change is reflected to all connected clients within ~1–2s via realtime subscription (not polling-only, not localStorage).
9. **Admin filtering**: filter list by status and/or pickup point; combine with search.
10. **Deployed on Vercel (free tier) with a real shared database** (not client-only storage) — accessible to everyone via one URL, working the same on any device/browser.

### Nice-to-Have (P1)
1. Duplicate-review queue: surfaces "possible duplicates" (same name, different number; or fuzzy-matched names) for an admin to confirm/merge/dismiss, rather than silently guessing.
2. CSV export of the full list / filtered view for the organizers' records.
3. PostHog analytics: track search usage, self-registration completions, admin actions — to see how organizers are actually using it.
4. Bulk import diff view: before committing a pasted batch, show "X new, Y duplicates skipped, Z possible duplicates" for confirmation.
5. Basic audit trail: who (which admin) changed a status/pickup point and when.

### Future Considerations (P2)
- Multi-event templating (reuse for future GRACE OUTPOST-style events).
- WhatsApp Business API ingestion instead of manual paste.
- SMS confirmation to registrants.
- Offline-capable PWA for poor-connectivity venues.

## Data Model (sketch)
```
registrants
  id (uuid, pk)
  name (text)
  phone_raw (text)              -- as originally entered
  phone_canonical (text, unique)-- normalized E.164-ish key, dedup target
  status (enum: not_called, pending, confirmed, tentative)
  pickup_point_id (fk, nullable)
  note (text, nullable)
  source (enum: bulk_import, self_registered)
  possible_duplicate_of (uuid, nullable, fk -> registrants.id)
  created_at, updated_at

pickup_points
  id (uuid, pk)
  name (text)
  is_active (bool)

admin_users
  id (uuid, pk)
  email/phone (auth identity via Supabase Auth)
  role (enum: caller, admin)
```

## Tech Stack Decision
- **Frontend/hosting**: Next.js on Vercel (free tier) — matches your existing deploy target.
- **Backend/data**: Supabase (Postgres, free tier) for the shared DB, Realtime subscriptions (live sync across devices), Auth (admin login), and Row-Level-Security (RBAC enforcement at the DB layer, not just UI).
- **Search**: Postgres `pg_trgm`/ILIKE for fast fuzzy name/phone search; debounced client query.
- **Analytics**: PostHog (free tier), client + a few server events.
- Rationale: this is the only combination in the free-tier bracket that gives real cross-device realtime sync *and* DB-level RBAC without building a custom backend from scratch — critical since "browser-only" storage was explicitly ruled out.

## Success Metrics
- **Leading**: ≥95% of pasted WhatsApp entries parsed correctly without manual fixes (checked against a sample batch); search returns results in <500ms perceived; 100% of status changes visible on a second device within 2s.
- **Lagging**: zero registrants double-called (per organizer self-report after the event); admin team reports the list as "usable" vs. the old WhatsApp-scroll method.

## Open Questions
- What are the actual 2–3 pickup point names/locations? (organizer — needed before hardcoding options, though they're configurable so not blocking)
- Who counts as "Admin" vs. "Caller" — is it just you plus the callers seen in the screenshots (Pst. M, Melody, Preston, etc.)? (organizer — needed to set up initial accounts)
- Is there a hard cutoff for registrations (e.g., end of day Sept 25) that the tool should reflect in the UI? (organizer, non-blocking)
- Any preference on phone-based OTP login for admins vs. simple email/password? (you — non-blocking, email/password is faster to ship)

## Timeline
- Event is Sept 26–27, 2026 (current date Sept 22) — v1 (all P0 items) needed within 1–2 days to leave time for the org to actually import the existing list and start calling.
- Suggested phasing: P0 today/tonight → import real data + smoke test tomorrow morning → P1 items (dup review queue, CSV export) only if time allows before the 26th.
