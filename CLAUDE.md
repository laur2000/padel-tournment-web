# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js application for managing Padel tournaments with automated matchmaking, waitlist management, and email/push notifications. Uses PostgreSQL with Prisma ORM and NextAuth.js for authentication.

## Development Commands

### Setup & Build
```bash
npm install                    # Install dependencies
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Run database migrations
npm run dev                   # Start development server (http://localhost:3000)
npm run build                 # Build for production (includes prisma generate)
npm start                     # Start production server
```

### Testing
```bash
npm run unit                  # Run unit tests with Vitest
npm run unit:coverage         # Run unit tests with coverage report
npm run e2e                   # Run E2E tests with Playwright (auto-starts dev server)
npm run test:coverage         # Run both unit and E2E tests with coverage
```

### Linting
```bash
npm run lint                  # Run ESLint
```

### Database Operations
```bash
npx prisma studio             # Open Prisma Studio (database GUI)
npx prisma migrate reset      # Reset database and re-run migrations
npx prisma db push            # Push schema changes without creating migration
```

## Architecture

### Authentication System
- **Provider**: NextAuth.js v4 with JWT session strategy
- **Adapters**: Prisma adapter for database persistence
- **Strategies**:
  - Email/Password (Argon2 hashing)
  - Google OAuth
  - Guest users (no auth, created by admins)
- **Session Management**: JWT tokens stored in cookies; user data fetched fresh from DB on each session to avoid storing large base64 images in JWT
- **Key Files**:
  - `lib/auth.ts` - NextAuth configuration
  - `app/api/auth/[...nextauth]/route.ts` - Auth API routes
  - `lib/actions/auth.ts` - Registration/login actions

### Database Schema (Prisma)
Key models and relationships:
- **User**: Core user entity with password, OAuth accounts, admin flags, and guest user support
- **Meeting**: Represents a scheduled Padel match session with location, time, and court count
- **Participation**: Junction table tracking user participation status (JOINED/WAITLISTED/LEFT/REMOVED_BY_TRUNCATION) with timestamps
- **Match/MatchTeam/MatchTeamMember**: Generated matchmaking results (courts, teams, players)
- **PushSubscription**: Web push notification endpoints per user

**Important**: Use Serializable isolation level for transactions involving participation status changes to prevent race conditions.

### Core Business Logic

#### Matchmaking Algorithm (`lib/matchmaking.ts`)
1. Fetches all JOINED participants for a meeting
2. Shuffles participants using Fisher-Yates algorithm
3. Chunks into groups of 4 players (2v2 teams)
4. Creates Match records with teams and court assignments
5. Only creates matches for complete 4-player groups

**Note**: Matchmaking expects truncation to have already occurred (handled by scheduler).

#### Scheduler (`lib/scheduler.ts`)
Automated background processing triggered by cron jobs:

**`processReminders()`**:
- Finds meetings 24h out
- Sends email + push notifications to unconfirmed JOINED participants
- Marks reminders as sent to prevent duplicates

**`processMeetingsFinalization()`** (runs for meetings <30min away):
1. **Auto-Confirm**: Confirms all unconfirmed JOINED participants
2. **Truncation**: Removes last-joined players if total % 4 !== 0 (status: REMOVED_BY_TRUNCATION)
3. **Matchmaking**: Calls `generateMatches()` to create matches
4. **Notifications**: Sends final team assignments via email + push to all JOINED participants

#### Meeting Actions (`lib/actions/meetings.ts`)
Server actions handling user interactions:

**`joinMeeting()`**:
- Transaction-based with Serializable isolation
- Checks capacity (numCourts * 4)
- Assigns JOINED if space available, otherwise WAITLISTED
- Revalidates paths for UI updates

**`leaveMeeting()`**:
- Prevents leaving if meeting started, matchmaking generated, or <15min away with all players confirmed
- Auto-promotes first waitlisted user if JOINED user leaves
- Sends promotion email + push notification

**Admin Actions**:
- `adminRemovePlayer()`: Remove any player (bypasses time constraints)
- `adminConfirmPlayer()`: Manually confirm attendance
- `adminAddPlayer()`: Add existing user or create guest user on-the-fly

#### Waitlist Promotion Logic
Automatic promotion occurs in two scenarios:
1. When a JOINED user calls `leaveMeeting()`
2. When an admin calls `adminRemovePlayer()`

Process:
- Find first WAITLISTED participant (ordered by `waitlistedAt ASC`)
- Update status to JOINED
- Send `sendWaitlistPromotionEmail()` and push notification
- All within transaction for consistency

### Notification System

**Email** (`lib/email.ts`):
- Uses Nodemailer with SMTP configuration from env vars
- Templates: Reminders, waitlist promotions, password resets, final matchmaking
- All emails are sent asynchronously (not awaited in critical paths)

**Push Notifications** (`lib/notifications.ts`, `lib/web-push.ts`):
- Uses Web Push API with VAPID keys
- Subscriptions stored per user in PushSubscription model
- Triggers: Reminders, promotions, matchmaking finalized
- Subscription endpoint: `/api/web-push/subscribe`

### File Structure Conventions
- `app/` - Next.js App Router pages and layouts
  - `api/` - API routes (auth, cron, web-push)
  - `auth/`, `meetings/`, `admin/`, `profile/` - Feature-based page directories
- `lib/` - Shared business logic and utilities
  - `actions/` - Next.js Server Actions
  - Core modules: `matchmaking.ts`, `scheduler.ts`, `email.ts`, `notifications.ts`
- `prisma/` - Database schema and migrations
- `tests/` - Testing organized by type
  - `unit/` - Vitest tests for business logic
  - `e2e/` - Playwright tests for critical user flows

### Testing Strategy

**Unit Tests** (Vitest + jsdom):
- Focus: Business logic in `lib/` directory
- Mocking: Prisma client, email sending, external APIs
- Coverage: Matchmaking algorithm, scheduler, user actions, password reset flows
- Run single test: `npx vitest tests/unit/matchmaking.test.ts`

**E2E Tests** (Playwright):
- Focus: Critical user journeys (admin creating meetings, login flows)
- Setup: Automatically starts dev server, uses fixtures for test data
- Browser: Chromium only in config
- Coverage: Uses monocart-reporter for combined coverage reports

### Path Aliases
- `@/*` maps to repository root (configured in tsconfig.json)
- Import example: `import { prisma } from "@/lib/prisma"`

### Environment Variables Required
```
POSTGRESQL_DATABASE_URL      # PostgreSQL connection string
NEXTAUTH_URL                 # Application URL
NEXTAUTH_SECRET              # JWT signing secret
GOOGLE_CLIENT_ID             # Google OAuth (optional)
GOOGLE_CLIENT_SECRET         # Google OAuth (optional)
CRON_SECRET                  # Bearer token for /api/cron/meetings
SMTP_HOST, SMTP_PORT         # Email configuration
SMTP_USER, SMTP_PASS, SMTP_FROM
NEXT_PUBLIC_VAPID_PUBLIC_KEY # Web Push public key
VAPID_PRIVATE_KEY           # Web Push private key
```

## Important Patterns

### Server Actions
All data mutations use Next.js Server Actions with `"use server"` directive. Common pattern:
1. Validate session with `getServerSession(authOptions)`
2. Perform DB operations (often in transactions)
3. Call `revalidatePath()` to update client cache
4. Optional: `redirect()` for navigation

### Concurrency Control
- Use `prisma.$transaction()` with `isolationLevel: "Serializable"` for critical operations (join/leave meeting)
- Prevents race conditions when multiple users join simultaneously

### Time-Based Business Rules
- Reminders: 24h before meeting
- Confirmation window: Opens 24h before, required for participation
- Auto-confirm: 15min before meeting
- Leave restrictions: Cannot leave if started, matchmaking generated, or <15min with all confirmed
- Truncation + Matchmaking: Triggered <30min before meeting

### Status Flow
```
Participation Status Flow:
JOINED ←→ WAITLISTED (capacity-dependent)
JOINED → LEFT (user leaves or admin removes)
WAITLISTED → JOINED (promotion when spot opens)
JOINED → REMOVED_BY_TRUNCATION (automated cleanup for team balance)
```

### Revalidation Strategy
Always revalidate both specific and list pages after mutations:
```typescript
revalidatePath(`/meetings/${meetingId}`); // Detail page
revalidatePath("/meetings");              // List page
```

## Cron Job Integration
External scheduler should call `/api/cron/meetings` with Bearer token authentication:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/meetings
```

Route executes both `processReminders()` and `processMeetingsFinalization()`.
