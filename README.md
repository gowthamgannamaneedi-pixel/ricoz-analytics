# RicozAnalytics

Enterprise-grade analytics platform built for high-performance data intelligence, customizable KPIs, interactive visualizations, and automated reporting.

---

## Architecture

```text
React Frontend
      ↓
Node/Express Backend
      ↓
Supabase PostgreSQL
```

- **Frontend**: Single-Page Application (SPA) built with React 18 and Vite. Communicates with the backend via centralized API services.
- **Backend**: Express REST API service providing authentication, RBAC, analytics calculations, audit logging, rate limiting, and reporting.
- **Database**: PostgreSQL hosted on Supabase (with fallback in-memory store for local testing).

---

## Project Structure

```text
ricoz-analytics/
├── client/          # React + Vite frontend (Tailwind CSS, React Router, Recharts, Lucide Icons)
├── server/          # Node.js + Express backend (REST API, PostgreSQL, JWT Auth, bcryptjs)
├── ml-service/      # Python + FastAPI forecasting and AI analytics service (optional microservice)
├── .gitignore       # Git ignore rules protecting secrets, logs, and build artifacts
└── README.md
```

---

## Local Setup

Follow these steps to run RicozAnalytics locally:

### 1. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment Files

**Backend Environment:**
```bash
cd server
cp .env.example .env
```
Update `server/.env` with your PostgreSQL database URL, JWT secret, and Supabase credentials.

**Frontend Environment:**
```bash
cd ../client
cp .env.example .env
```
Update `client/.env` if you need custom API URLs or feature flags.

### 3. Start Backend Service
```bash
cd server
npm run dev
```
The backend server runs on `http://localhost:5000` by default.
- Health Check: `http://localhost:5000/api/health`
- Readiness Probe: `http://localhost:5000/api/ready`

### 4. Start Frontend Application
```bash
cd client
npm run dev
```
The React frontend starts at `http://localhost:5173`.

---

## Environment Variables

### Backend (`server/.env`)
Copy from `server/.env.example`.

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP port for Express API | `5000` |
| `NODE_ENV` | Application environment (`development` / `production` / `test`) | `development` |
| `CLIENT_URL` | Allowed origin for frontend client (CORS) | `http://localhost:5173` |
| `CORS_ORIGIN` | Comma-separated allowed CORS origins | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:[PASSWORD]@[HOST]:5432/ricoz_analytics` |
| `DB_POOL_MAX` | Maximum database connection pool size | `20` |
| `DB_STATEMENT_TIMEOUT_MS` | Query execution timeout in milliseconds | `15000` |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens (minimum 32 characters in production) | High-entropy secret |
| `JWT_EXPIRATION` | Token expiration duration | `7d` |
| `SUPABASE_URL` | Supabase project URL | `https://[YOUR_PROJECT_ID].supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous public key | `your-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only, optional) | `your-service-key` |
| `GEMINI_API_KEY` | Google Gemini API key for AI assistant features (optional) | `your-gemini-key` |
| `ML_SERVICE_URL` | Python FastAPI ML service endpoint (optional) | `http://127.0.0.1:8000` |

### Frontend (`client/.env`)
Copy from `client/.env.example`.

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for backend API requests | `http://localhost:5000/api` |
| `VITE_ENABLE_DEV_AUTH` | Toggle quick-login test accounts helper on Login page | `false` |
| `VITE_SUPABASE_URL` | Optional Supabase project URL for frontend client | (empty) |
| `VITE_SUPABASE_ANON_KEY` | Optional Supabase anon key for frontend client | (empty) |

---

## Available NPM Scripts

### Backend (`server/`)
- `npm run dev`: Start backend in watch/development mode.
- `npm start`: Start backend in production mode.
- `npm test`: Run automated test suites (Health, Auth, Security, Analytics, and Phases 4–18).
- `npm run test:supabase`: Run Supabase connectivity and integration verification.

### Frontend (`client/`)
- `npm run dev`: Start Vite development server with hot module replacement (`http://localhost:5173`).
- `npm run build`: Build production bundle into `client/dist/`.
- `npm run preview`: Locally preview production build.

---

## Database & Supabase Setup

The database schema and migrations are located in:
- `server/migrations/20260923_initial_schema.sql`
- `server/models/schema.sql`

To apply schema to Supabase:
1. Open your Supabase Project Dashboard.
2. Navigate to **SQL Editor** -> **New query**.
3. Paste the contents of `server/migrations/20260923_initial_schema.sql` and click **Run**.
4. The tables, triggers, and Row Level Security (RLS) policies will be provisioned.

---

## Production Deployment Architecture

In production, RicozAnalytics separates concerns cleanly:

1. **Frontend**: Static React build (`client/dist`) hosted on a CDN / Static Web Host (e.g. Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront).
   - Environment: Set `VITE_API_URL=https://<DEPLOYED-BACKEND-DOMAIN>/api`.
2. **Backend**: Node.js/Express service containerized or deployed on a platform like Render, Railway, Fly.io, or AWS ECS/App Runner.
   - Environment: Set `NODE_ENV=production`, `PORT=5000`, `CLIENT_URL=https://<DEPLOYED-FRONTEND-DOMAIN>`, `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
3. **Database**: Managed PostgreSQL hosted on Supabase with connection pooling enabled.
