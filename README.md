# 🎬 Reel Insights Platform
### 3-in-1 Analytics, DOM Override & View Service Automation

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.4-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![CORS](https://img.shields.io/badge/CORS-Enabled-emerald?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

A high-performance enterprise analytics engine designed to simulate and mirror verified Instagram Reel velocity metrics, provide persistent campaign tracking via SQLite, and expose CORS-ready REST API endpoints for seamless browser extension DOM overrides.

---

## 🌟 Architecture Overview

The system is built on a modular three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser Extension (DOM)                   │
│        Directly injects live statistics via REST API        │
└──────────────────────────────▲──────────────────────────────┘
                               │ CORS (* / JSON)
┌──────────────────────────────▼──────────────────────────────┐
│                    Next.js API Engine                       │
│     GET /api/campaigns/current | POST /api/campaigns/update │
└───────────────▲─────────────────────────────▲───────────────┘
                │                             │
┌───────────────▼───────────────┐ ┌───────────▼───────────────┐
│     Mathematical Engine       │ │       Prisma ORM          │
│   Deterministic Mulberry32    │ │   Zero-Config SQLite      │
│   Instagram Velocity Curves   │ │   ReelCampaign Model      │
└───────────────────────────────┘ └───────────────────────────┘
```

---

## 🧮 Core Mathematical Engine (`src/lib/metricsEngine.ts`)

The metrics engine enforces rigorous mathematical invariants calibrated to match authentic Instagram algorithm distribution patterns:

1. **Deterministic Pseudo-Random Generation (Mulberry32)**:
   - Uses a seeded generator keyed on `views` and `videoDurationSeconds` to guarantee that UI refreshes never trigger sporadic flickering.
2. **Viewers Ratio (65% to 70%)**:
   - `viewers` strictly calculates between `65%` and `70%` of `views` (e.g., 100,000 views produces 65,000–70,000 viewers).
3. **Average Watch Time**:
   - Normalized proportionally to video duration: a standard 60-second video strictly yields an integer between `40s` and `45s`.
4. **Follows Velocity (20 to 25 per 100k views)**:
   - `follows = Math.round((views / 100000) * ratio)` where `ratio ∈ [20, 25]`.
5. **Top 5 Countries (Strict Descending Order)**:
   - Always outputs strictly descending percentage ranges:
     - **USA** / **United States** (Configurable label): `26.4%` – `31.2%`
     - **UK**: `18.1%` – `21.5%`
     - **Canada**: `12.4%` – `15.0%`
     - **Australia**: `7.8%` – `10.2%`
     - **Germany**: `4.2%` – `6.5%`
6. **12-Point Dynamic Velocity Curve**:
   - Time-series progression points (`1h`, `2h`, `4h`, `8h`, `12h`, `24h`, `2d`, `3d`, `4d`, `5d`, `6d`, `7d`) exhibiting a steep initial surge tapering into an organic plateau.
   - Dynamic Y-axis scale benchmarks: `midTick` (~75% of views) and `topTick` (~150% of views) formatted in standard compact notation (`K`/`M`).

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

Persisted via SQLite for zero-config, portable local storage:

```prisma
model ReelCampaign {
  id                     String   @id @default(cuid())
  reelUrl                String?
  collaborationText      String   @default("Collaboration with cinematic.edits.fx and songs_movies.byte")
  videoDurationSeconds   Int      @default(60)
  views                  Int      @default(100000)
  viewers                Int
  avgWatchTimeSeconds    Int
  follows                Int
  likes                  Int      @default(1500)
  comments               Int      @default(0)
  reposts                Int      @default(15)
  shares                 Int      @default(49)
  saves                  Int      @default(144)
  followersPercentage    Float    @default(0.4)
  nonFollowersPercentage Float    @default(99.6)
  countriesJson          String   // JSON array of CountryMetric
  graphDataJson          String   // JSON array of GraphDataPoint
  serviceStatus          String   @default("IDLE") // IDLE | RUNNING | COMPLETED
  updatedAt              DateTime @updatedAt
  createdAt              DateTime @default(now())
}
```

---

## 🚀 REST API Reference

All API routes are configured with permissive CORS headers (`Access-Control-Allow-Origin: *`) and handle preflight `OPTIONS` requests to enable direct access from browser extensions and external clients.

### 1. Get Current Active Campaign
```http
GET /api/campaigns/current
```
- **Description**: Returns the active campaign or automatically provisions and persists the default 100,000 views baseline.
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "cmv8k75fu0000u91on9cu5vh2",
    "views": 100000,
    "viewers": 68639,
    "avgWatchTimeSeconds": 44,
    "follows": 21,
    "likes": 1500,
    "countriesJson": "[{\"country\":\"USA\",\"percentage\":27.9},...]",
    "graphDataJson": "[{\"time\":\"1h\",\"all\":7647,...},...]",
    "serviceStatus": "IDLE"
  }
}
```

### 2. Recalculate & Update Campaign
```http
POST /api/campaigns/update
Content-Type: application/json
```
- **Payload**:
```json
{
  "views": 250000,
  "videoDurationSeconds": 60,
  "likes": 3200,
  "comments": 12,
  "reposts": 35,
  "shares": 110,
  "saves": 380,
  "collaborationText": "Collaboration with cinematic.edits.fx",
  "countryLabelFormat": "USA"
}
```
- **Response**: Returns the updated record and newly computed scale ticks (`maxScale`, `midTick`, `topTick`).

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- `npm`

### Installation
1. Clone the repository:
```bash
git clone https://github.com/mukithasan232/afnan_smm_panel.git
cd afnan_smm_panel
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
```

4. Initialize SQLite Database & Prisma Client:
```bash
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the dashboard.

---

## 📂 Project Structure

```
├── prisma/
│   └── schema.prisma        # SQLite schema & ReelCampaign definition
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── campaigns/
│   │   │       ├── current/ # GET /api/campaigns/current
│   │   │       └── update/  # POST /api/campaigns/update
│   │   ├── globals.css      # Tailwind CSS styling tokens
│   │   ├── layout.tsx       # Root layout wrapper
│   │   └── page.tsx         # Real-time preview dashboard
│   └── lib/
│       ├── cors.ts          # Cross-origin response helpers
│       ├── metricsEngine.ts # Deterministic mathematical rules & PRNG
│       └── prisma.ts        # Prisma client singleton
├── .env.example             # Environment configuration template
├── package.json
└── tsconfig.json
```

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
