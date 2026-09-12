# QuorumGuard

**Partition-Aware Payment Authorization with Adaptive Fraud Intelligence**

A college-level distributed systems prototype demonstrating:
- Inline fraud detection before every authorization
- Partition-tolerant decision making (not blind approval)
- Outbox pattern for durable event queuing
- Idempotency (duplicate-request protection)
- Eventual consistency via outbox replay on reconnect

> ⚠️ **Academic demo only.** No real card numbers, no real payment networks. Masked tokens only.

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run

```bash
# 1. Copy env file
cp .env.example .env

# 2. Install all dependencies
npm run install:all

# 3. Start both backend and frontend
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

---

## Project Structure

```
quorumguard/
├── backend/
│   ├── server.js              # Express entry point (helmet, CORS, rate limiting)
│   ├── database.js            # SQLite schema (WAL mode, parameterized queries)
│   ├── routes.js              # API routes with input validation
│   ├── services/
│   │   ├── fraudService.js    # Multi-factor risk scoring
│   │   └── partitionService.js # Network state + outbox management
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/Dashboard.jsx
│   │   ├── components/        # LiquidButton, RiskMeter, NetworkDiagram, etc.
│   │   └── services/api.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── data/                      # SQLite DB lives here (gitignored)
├── .env.example
└── package.json               # Root orchestrator (concurrently)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/authorize` | Authorize a payment (fraud-screened first) |
| GET | `/api/transactions` | List all transactions |
| GET | `/api/system-status` | Network + metrics status |
| POST | `/api/partition` | Simulate a network partition |
| POST | `/api/restore` | Restore network + replay outbox |
| GET | `/api/outbox` | View pending outbox events |
| POST | `/api/region` | Switch active region (A or B) |

---

## Security Notes

- All SQL uses parameterized statements — no string concatenation
- Real card PANs are actively rejected by the backend
- `helmet` sets secure HTTP headers
- CORS is locked to `http://localhost:5173` only
- Rate limiting on `/api/authorize` (30 req/min default)
- Idempotency enforced at DB level via `UNIQUE` constraint
- `.env` is gitignored; secrets never in source
- Stack traces never sent to client

Run `npm audit` before submitting or demoing.

---

## Demo Scenarios

1. **Normal Approval** — ₹2,500 low-risk → APPROVED
2. **Fraud Detection** — ₹90,000 high-risk → DECLINED
3. **Partition + Safe** — Partition active, ₹3,000 low-risk → APPROVED (DEGRADED MODE)
4. **Partition + Risky** — Partition active, ₹75,000 → DECLINED
5. **Recovery** — Restore → Outbox replay → SYNCHRONIZED
