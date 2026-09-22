# RicozAnalytics

Enterprise-grade analytics platform built for high-performance data intelligence, customizable KPIs, interactive visualizations, and automated reporting.

## Project Structure

```text
ricoz-analytics/
├── client/          # React + Vite frontend (Tailwind CSS, React Router, Recharts, Lucide Icons)
├── server/          # Node.js + Express backend (REST API, PostgreSQL, JWT Auth, bcryptjs)
├── ml-service/      # Python + FastAPI forecasting and AI analytics service
├── .gitignore
└── README.md
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Recharts, Lucide Icons, Context API
- **Backend**: Node.js, Express, PostgreSQL (`pg`), JWT, bcryptjs, Morgan, CORS
- **ML / AI Service**: Python, FastAPI, Gemini API

---

## Environment Variables

### Server (`server/.env`)
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ricoz_analytics
JWT_SECRET=your_super_secret_jwt_key_ricoz_2026
NODE_ENV=development
```

---

## PostgreSQL Database Setup & Migration

The schema definition is located at [server/models/schema.sql](file:///c:/Users/gowth/Downloads/Ricoz_analysis_project/server/models/schema.sql).

### SQL Schema Definition
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'manager', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

Database tables are automatically created on server boot via `db.initDb()`.

---

## Authentication REST API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user (`name`, `email`, `password`, `role`) | No |
| `POST` | `/api/auth/login` | Log in user (`email`, `password`) -> Returns JWT & user | No |
| `GET` | `/api/auth/me` | Retrieve profile of authenticated user | `Bearer <token>` |
| `GET` | `/api/health` | Service health status | No |

---

## Getting Started

### 1. Backend Setup
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
Runs on `http://localhost:5000` by default.

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
```
Runs on `http://localhost:5173`.

### 3. Running Automated Test Suites
```bash
cd server
npm test
```
Executes both the Health Check and full 9-point Authentication integration test suite.
