# 🎾 Padel Tournament Manager

A complete web application for managing Padel matches, tournaments, and player participation. Built with Next.js, this platform handles everything from scheduling matches to automated matchmaking and waitlist management.

## 🚀 Key Features

### 👤 User Experience
- **Authentication**: Secure login via Email/Password or Google (NextAuth.js).
- **Profile Management**: customizable user profiles with avatar uploads.
- **Dashboard**: View upcoming matches, status (Joined/Waitlisted), and match history.

### 📅 Match Management
- **Scheduling**: Admins can create matches specifying location, time, and number of courts.
- **Geolocation**: Integrated map support (Leaflet) for match locations using OpenStreetMap data.
- **Participation System**:
  - **Join**: Users can sign up for open slots.
  - **Waitlist**: Automatic waitlist handling when matches are full.
  - **Auto-Promotion**: If a player leaves, the first waitlisted user is automatically promoted and notified.
  - **Confirmation**: Required attendance confirmation 24h before the match.
  - **Lockout**: Players cannot leave once the game has started or matchmaking is finalized (imminent solidified matches).

### 🤖 Automation & Logic
- **Matchmaking Algorithm**:
  - Automatically shuffles confirmed players.
  - Truncates participants to ensure team divisibility by 4 (last joined are removed if necessary).
  - Assigns courts and teams.
- **Cron Jobs**:
  - **Reminders**: Sends email reminders 24h before kick-off.
  - **Auto-Confirm**: Automatically confirms checked-in players 15m before start.
  - **Finalization**: Triggers matchmaking and sends team details to all players.

### 📧 Notifications
- **Transactional Emails**:
  - Waitlist promotion alerts.
  - Match reminders.
  - Password resets.
  - Final matchmaking results (Teams & Court assignments).

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Auth**: [NextAuth.js v4](https://next-auth.js.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [MUI](https://mui.com/)
- **Maps**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Email**: [Nodemailer](https://nodemailer.com/)
- **Testing**:
  - Unit: [Vitest](https://vitest.dev/)
  - E2E: [Playwright](https://playwright.dev/)

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Local or Cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/laur2000/padel-tournment-web.git
   cd padel-tournment-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   # Database
   POSTGRESQL_DATABASE_URL="postgresql://user:password@localhost:5432/padel_db"

   # Auth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-super-secret-key"
   GOOGLE_CLIENT_ID=""
   GOOGLE_CLIENT_SECRET=""

   # Cron
   CRON_SECRET="your-cron-secret-key"

   # Email (SMTP)
   SMTP_HOST="smtp.example.com"
   SMTP_PORT=587
   SMTP_USER="user@example.com"
   SMTP_PASS="password"
   SMTP_FROM="noreply@padelapp.com"
   ```

4. **Initialize Database**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## 🧪 Testing

The project maintains high code quality through a dual-layer testing strategy.

### Unit Tests
Business logic (Matchmaking, actions, scheduler) is tested with Vitest.
```bash
npm run unit
# With coverage
npm run unit:coverage
```

### End-to-End Tests
Critical user flows (Admin creation, Login) are tested with Playwright.
```bash
npm run e2e
```

### Full Coverage Check
```bash
npm run test:coverage
```

## ⏳ Cron Jobs

The application exposes an API route for automation, typically triggered by an external scheduler (e.g., Vercel Cron, GitHub Actions).

- **Route**: `/api/cron/meetings`
- **Method**: `GET`
- **Auth**: Bearer Token (`CRON_SECRET`)

Logic handled:
1. Sends participant reminders (24h lookahead).
2. Auto-confirms participants.
3. Truncates surplus players.
4. Generates matchmaking.
5. Sends final match emails.
