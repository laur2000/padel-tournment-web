# copilot-instructions.md
## Project: Padel Tournament Meetings (Next.js + Vercel + Prisma + Vercel Postgres + NextAuth + MUI)

You are an agentic coding assistant working inside an existing Vercel-deployed Next.js repo (or creating it if missing). Your goal is to implement the features below **without inventing business requirements** and with **production-grade security**. When something is ambiguous, **stop and ask**.

---

## Non-negotiables
1. **No assumptions**: Do not invent requirements, UX, or business rules beyond what’s written here. Ask if unclear.
2. **Security first**: server-side validation, authN/authZ, safe error handling, rate limiting on auth endpoints, secure cookies, no secret leakage.
3. **Prisma-only DB access**: all DB reads/writes via Prisma. Use migrations.
4. **NextAuth (Auth.js)** with Google OAuth + Credentials (email/password).
5. **MUI (Material UI)** for UI; App Router compatible SSR setup.
6. **Idempotency + concurrency safety**: join/waitlist promotion, auto-confirm, matchmaking generation must be safe under concurrent requests and cron retries.
7. **Small PRs**: implement in incremental steps; keep diffs focused; update tests/docs as you go.

---

## Stack & Conventions
- Next.js App Router, TypeScript strict.
- Route handlers in `app/api/**/route.ts` for server endpoints.
- Prefer server-side authorization checks in route handlers/server actions.
- Validation: `zod`.
- Password hashing: **argon2** preferred; bcrypt acceptable if argon2 causes deployment friction.
- Email sending: use **nodemailer** with Gmail SMTP using a Gmail app password/token (user-provided).
- Rate limiting: use a lightweight approach compatible with Vercel (Upstash Redis if available; otherwise a conservative in-memory fallback for local + clear note that production requires durable store).
- Testing: Vitest or Jest (pick what repo already uses). Focus on domain logic + critical handlers.

---

## Confirmed Business Rules (do not change)
### Roles
- Users register normally.
- Admin is a normal user with DB boolean `is_admin = true` (manually set in DB; no UI for this).

### Meetings
- Admins can create a meeting with:
  - `place` (string)
  - `startTime` (datetime)
  - `numCourts` (int)
- Timezone is always **Europe/Madrid**.
- Each court has **4 players** (2 vs 2). Capacity = `numCourts * 4`.

### Join / Waitlist
- If meeting has free slots (JOINED count < capacity), user becomes **JOINED**.
- If full, user becomes **WAITLISTED** (FIFO).
- When a JOINED player leaves, **the first WAITLISTED user is automatically promoted** to JOINED.
- A WAITLISTED user **cannot confirm** until promoted to JOINED.
- All operations must be race-condition safe.

### Confirmations & Matchmaking Timing
- Users can confirm attendance **only if JOINED**.
- **15 minutes before start**, cron job runs:
  1) auto-confirms any JOINED but unconfirmed participants.
  2) generates matchmaking (random) at that moment (not earlier).
- When generating matchmaking, if JOINED players are **not divisible by 4**, truncate:
  - Let `joinedCount` be number of JOINED participants at matchmaking time.
  - Compute `r = joinedCount % 4`.
  - If `r != 0`, remove the **last r players that joined** from the meeting before generating matchmaking.
  - “Last joined” is determined by `joinedAt` timestamp (descending).
  - After removal, JOINED count is divisible by 4.
  - Do not generate matchmaking if resulting JOINED count is 0.

### Matchmaking
- Random matchmaking:
  - Shuffle JOINED participants (after truncation and auto-confirm).
  - Create pairs of 2 (teams), then matches of 2 teams (4 players).
  - Assign court numbers sequentially from 1..numCourts (only as many courts as needed).
- Persist results in DB.
- Must be **idempotent** (cron can run multiple times; only one matchmaking result per meeting unless reset feature is explicitly implemented later).

---

## Requirements you MUST implement
### Auth
- Registration (email/password)
- Login (credentials)
- Google OAuth login
- Forgot password flow:
  - Request reset: never reveal whether email exists.
  - Generate single-use token with expiry; store **hashed token** in DB.
  - Reset password: validate token + expiry; update password; invalidate used token(s).
  - Send reset email via nodemailer Gmail SMTP using env vars.

### UI (MUI)
Pages:
- `/` (basic landing)
- `/auth/login`
- `/auth/register`
- `/auth/forgot-password`
- `/auth/reset-password?token=...`
- `/meetings` list
- `/meetings/[id]` detail (join/leave/confirm, show status)
- `/admin/meetings/new` create meeting (admin only)
- `/admin/meetings/[id]` admin view (participants + waitlist + matchmaking status)

Keep UI minimal but usable:
- loading states, basic error display, accessible forms.

### Cron Job (Vercel Cron)
- Implement an API route to be called by Vercel Cron, e.g. `GET /api/cron/meetings`.
- Cron runs every 1–5 minutes and processes meetings whose start time is in the next 15 minutes window:
  - Determine meetings where `startTime - now <= 15m` and not processed yet.
  - Auto-confirm JOINED participants missing `confirmedAt`.
  - Apply truncation rule (remove last joined r players).
  - If matchmaking not generated yet and JOINED count divisible by 4 and >0, generate and persist matchmaking.
- Idempotency:
  - Cron may run multiple times. Ensure it does not re-generate or re-truncate repeatedly.
  - Use DB flags/timestamps to record steps: e.g. `autoConfirmProcessedAt`, `matchmakingGeneratedAt`, `truncationAppliedAt`.
- Security:
  - Protect cron endpoint (e.g. `CRON_SECRET` header).
  - Do not expose sensitive info in response.

---

## Data Model (Prisma) Guidance
Use Prisma schema compatible with NextAuth Prisma Adapter.

Entities (suggested):
- `User`:
  - id, email (unique), name, image, hashedPassword (nullable), is_admin boolean default false, timestamps
- NextAuth tables: `Account`, `Session`, `VerificationToken` (if using adapter)
- `PasswordResetToken`:
  - id, userId, tokenHash, expiresAt, usedAt, createdAt
- `Meeting`:
  - id, place, startTime (store as UTC DateTime; treat as Europe/Madrid when parsing/displaying), numCourts
  - status timestamps: `autoConfirmProcessedAt`, `truncationAppliedAt`, `matchmakingGeneratedAt`
  - createdByUserId, createdAt, updatedAt
- `Participation`:
  - id, meetingId, userId
  - status enum: JOINED | WAITLISTED | LEFT | REMOVED_BY_TRUNCATION
  - joinedAt, waitlistedAt, leftAt, removedAt, confirmedAt
  - `joinedOrder` derived from joinedAt; waitlist FIFO uses waitlistedAt
  - Unique constraint: (meetingId, userId)
  - Indexes: meetingId+status, meetingId+joinedAt, meetingId+waitlistedAt
- `Match` (or `MatchmakingMatch`):
  - id, meetingId, courtNumber, createdAt
- `MatchTeam`:
  - id, matchId, side enum A|B
- `MatchTeamMember`:
  - id, teamId, userId
  - Unique constraints to prevent duplicates per meeting

Transactions:
- Use Prisma `$transaction` with `SERIALIZABLE` when feasible for join/leave/promotion and matchmaking generation.
- Always re-check counts inside transaction.

---

## Algorithmic invariants (write tests for these)
1. Capacity never exceeded for JOINED.
2. WAITLIST FIFO promotion on JOINED leave.
3. WAITLIST cannot confirm.
4. Cron auto-confirm sets `confirmedAt` for all JOINED lacking it.
5. Truncation removes last `r` JOINED by joinedAt so JOINED % 4 == 0.
6. Matchmaking includes each remaining JOINED player exactly once.
7. Court numbers are within 1..numCourts and number of matches equals JOINED/4.
8. Idempotency:
   - rerunning cron does not change already-generated matchmaking.

---

## File/Folder expectations
Prefer:
- `app/` routes and pages
- `lib/` shared utilities (auth, prisma, validation, email, matchmaking)
- `prisma/` schema and migrations
- `tests/` or colocated tests in `lib/**/__tests__`

---

## Environment variables (provide `.env.example`)
Minimum:
- `POSTGRESQL_DATABASE_URL` (Vercel Postgres)
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CRON_SECRET`
- `SMTP_HOST` (smtp.gmail.com)
- `SMTP_PORT` (465 or 587)
- `SMTP_SECURE` (true for 465)
- `SMTP_USER` (gmail address)
- `SMTP_PASS` (gmail app password)
- Optional rate-limit backing store (if using Upstash):
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

Never commit real secrets.

---

## Implementation plan (do this in small steps)
When coding, follow this order and keep each step mergeable:

1) Project baseline:
   - Confirm Next.js App Router + TS strict + lint.
   - Add Prisma + Vercel Postgres setup; add Prisma adapter tables.
   - Add `lib/prisma.ts` singleton.

2) Auth:
   - NextAuth config (Google + Credentials).
   - Registration API + UI.
   - Login UI.
   - Role propagation: include `is_admin` in session (but verify server-side on admin routes).

3) Forgot password:
   - Token table + hashing + expiry + email sender via nodemailer.
   - Pages + API handlers.

4) Meetings core:
   - Prisma models for Meeting + Participation.
   - Admin create meeting (protected).
   - Meetings list + detail.

5) Join/leave/waitlist/promotion:
   - Transaction-safe endpoints.
   - UI actions.
   - Tests for concurrency-sensitive logic (simulate with sequential transactions).

6) Confirmation:
   - Confirm endpoint for JOINED only.
   - UI.

7) Cron + auto-confirm + truncation + matchmaking:
   - Cron route protected with `CRON_SECRET`.
   - Implement idempotent processing markers.
   - Implement matchmaking persistence.
   - Tests for truncation + matchmaking.

8) Polish:
   - MUI SSR correctness.
   - Error handling, loading states.
   - README + `.env.example`.

---

## Coding standards
- Always validate input with Zod on server.
- Never trust client-provided role/admin flags.
- Use `httpOnly` cookies and secure session settings.
- Avoid leaking existence of accounts in auth/forgot password responses.
- Log errors with minimal sensitive context.
- Prefer explicit enums and state machines for participation transitions.

---

## “Stop and ask” list
You MUST stop and ask before implementing anything not specified here, including:
- Admin edit/cancel/reset meeting features
- Notifications beyond reset email
- Skill-based matchmaking
- Multi-timezone support
- Changing truncation behavior (e.g., moving removed players to waitlist instead of removal)
- Any payment, profiles, or extras

End of instructions.