# Sentrix

**AI Agent Observability for Solana** — Monitor, audit, and kill-switch any autonomous AI agent transacting on-chain.

> *"Datadog for AI agents on Solana."*

[![Built for Colosseum Frontier](https://img.shields.io/badge/Colosseum-Frontier%20Hackathon-6366f1)](https://www.colosseum.org)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195)](https://solana.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

Thousands of AI agents are autonomously spending real money on Solana — trading tokens, executing swaps, making payments — with **zero oversight**. There's no monitoring layer between "agent decides to transact" and "transaction hits the chain."

Solana finalizes in 400ms. By the time a human notices something wrong, the money is gone.

- **No real-time visibility** into what agents are doing
- **No automated anomaly detection** for rogue behavior
- **No kill switch** to freeze agents before they cause damage
- **No guardrails** to enforce spending limits or program restrictions

It's not *if* a major agent failure happens — it's *when*.

## The Solution

Sentrix provides a complete observability layer for AI agents on Solana:

| Capability | What It Does |
|---|---|
| **Monitor** | Real-time dashboard showing every transaction, spend patterns, and agent health |
| **Detect** | Automatic anomaly detection — spending velocity spikes, unknown program interactions, policy violations |
| **Protect** | Guardrails enforce spend limits and program allowlists before transactions reach the chain |
| **Kill Switch** | Instant agent freeze (manual or automatic) — sub-second response via WebSocket |

### 5 Lines to Integrate

```typescript
import { SentrixClient } from '@sentrix/sdk';

const sentrix = new SentrixClient({
  serverUrl: 'https://your-sentrix-server.com',
  agentId: 'my-trading-agent',
  keypair: agentKeypair,
  connection,
});

// Replace connection.sendTransaction() with:
await sentrix.sendTransaction(transaction);
// Guardrails enforced. Events emitted. Kill switch respected.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent (ElizaOS / Agent Kit / Custom)      │
│                                                                  │
│  agent.sendTransaction(tx)                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        @sentrix/sdk                              │
│                                                                  │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────────┐  │
│  │  Interceptor  │   │  Guardrails   │   │    Kill Switch     │  │
│  │              │   │               │   │                    │  │
│  │  Wraps       │   │  Max spend/tx │   │  WebSocket ← Server│  │
│  │  sendTx()    │   │  Hourly cap   │   │  Instant pause     │  │
│  │  Emits       │   │  Program      │   │  AgentPausedError  │  │
│  │  events      │   │  allowlist    │   │  on next tx        │  │
│  └──────┬───────┘   └──────┬────────┘   └─────────┬──────────┘  │
│         │                  │                      │              │
│         │          ALLOW / DENY                   │              │
└─────────┼──────────────────┼──────────────────────┼──────────────┘
          │                  │                      │
          │    Events (HTTP POST)        Kill commands (WebSocket)
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Sentrix Server                              │
│                    (Bun + Hono + SQLite)                         │
│                                                                  │
│  ┌────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │  REST API  │  │   Detection Engine    │  │   WebSocket    │  │
│  │            │  │                       │  │   Hub          │  │
│  │  /agents   │  │  Spend velocity (5m)  │  │                │  │
│  │  /events   │  │  Unknown program chk  │  │  Broadcast to  │  │
│  │  /txs      │  │  Auto-kill on         │  │  dashboard +   │  │
│  │  /config   │  │  CRITICAL severity    │  │  agents        │  │
│  └────────────┘  └───────────────────────┘  └────────────────┘  │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │   SQLite (WAL mode)    │  │   Helius Webhook Receiver     │  │
│  │                        │  │                                │  │
│  │  agents, events,       │  │   On-chain tx confirmation    │  │
│  │  transactions,         │  │   Decoded CPI instructions    │  │
│  │  anomalies             │  │                                │  │
│  └────────────────────────┘  └────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                   WebSocket (real-time)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Dashboard                                 │
│                  (React + Vite + Tailwind)                       │
│                                                                  │
│  ┌───────────┐  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Stats    │  │  Spend     │  │  Guardrails │  │  Kill     │ │
│  │  Bar      │  │  Chart     │  │  Config     │  │  Switch   │ │
│  │  (24h)    │  │  (area)    │  │  (live)     │  │  (toggle) │ │
│  └───────────┘  └────────────┘  └─────────────┘  └───────────┘ │
│                                                                  │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────────────────┐│
│  │  Agent    │  │  Tx Feed   │  │  Event Log                   ││
│  │  Sidebar  │  │  (live)    │  │  (live)                      ││
│  └───────────┘  └────────────┘  └──────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Dual Data Stream

Sentrix ingests two data streams for complete visibility:

```
SDK Intent Events ──────► Sentrix Server ◄────── Helius Webhooks
(what agent TRIED to do)                    (what landed on-chain)
```

- **SDK stream**: Agent intent, blocked transactions, guardrail violations — events that never touch the chain
- **Helius stream**: On-chain confirmations with decoded CPI instructions — ground truth

The delta between intent and reality is where bugs and exploits live.

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Runtime | **Bun** | Built-in SQLite, native WebSocket, fast |
| API | **Hono** | 14KB, Bun-native |
| DB | **SQLite (WAL)** | Zero config, single file |
| Real-time | **Bun WebSocket** | No deps, sub-second delivery |
| Frontend | **React + Vite + Tailwind** | Fast dev, polished UI |
| Charts | **Recharts** | Simple, composable |
| Tx Data | **Helius Webhooks** | Enhanced transaction data |
| Network | **Solana Devnet** | Free, no audit needed |

**No on-chain program.** Sentrix is a pure off-chain SDK + monitoring platform.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Node.js 18+ (for Vite)

### Install & Run

```bash
# Clone
git clone https://github.com/your-username/sentrix.git
cd sentrix

# Install dependencies
bun install

# Seed dashboard with demo data (optional)
bun run seed

# Start server + dashboard
bun run dev

# Server: http://localhost:4000
# Dashboard: http://localhost:5173
```

### Run Demo Scenarios

```bash
# Normal agent — 5 small transactions
bun run demo/agent.ts

# Rogue agent — escalation → anomaly detection → auto-kill
bun run demo/scenario.ts
```

---

## Project Structure

```
sentrix/
├── packages/
│   ├── sdk/                    # @sentrix/sdk — agent integration
│   │   └── src/
│   │       ├── client.ts       # SentrixClient (main entry)
│   │       ├── guardrails.ts   # Spend limits, program allowlist
│   │       ├── kill-switch.ts  # WebSocket kill switch
│   │       └── types.ts        # TypeScript interfaces
│   ├── server/                 # Sentrix API server
│   │   └── src/
│   │       ├── routes/         # REST endpoints
│   │       ├── detection/      # Anomaly detection engine
│   │       ├── db/             # SQLite schema + seed
│   │       └── ws/             # WebSocket hub
│   └── dashboard/              # React monitoring dashboard
│       └── src/
│           ├── components/     # UI components
│           ├── hooks/          # WebSocket + data hooks
│           └── lib/            # API client + utilities
└── demo/                       # Demo agent scripts
    ├── agent.ts                # Normal agent flow
    └── scenario.ts             # Rogue agent → auto-kill
```

---

## API Reference

### Server Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/events` | SDK pushes intent/result events |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/:id` | Agent status + config |
| `POST` | `/api/agents/:id/kill` | Activate kill switch |
| `DELETE` | `/api/agents/:id/kill` | Deactivate kill switch |
| `PUT` | `/api/agents/:id/config` | Update guardrails |
| `GET` | `/api/transactions` | Query transaction history |
| `GET` | `/api/transactions/stats` | 24h statistics |
| `POST` | `/webhook/helius` | Helius webhook receiver |
| `WS` | `/ws` | Real-time event stream |

### SDK API

```typescript
const sentrix = new SentrixClient({
  serverUrl: string,      // Sentrix server URL
  agentId: string,        // Unique agent identifier
  keypair: Keypair,       // Agent's Solana keypair
  connection: Connection,  // Solana RPC connection
  guardrails?: {
    maxSpendPerTx: number,     // Max SOL per transaction
    hourlySpendLimit: number,  // Max SOL per hour
    allowedPrograms: string[], // Whitelisted program IDs
  },
  onKilled?: () => void,  // Callback when kill switch activates
});

// Send with guardrails + monitoring
await sentrix.sendTransaction(tx);
await sentrix.sendAndConfirmTransaction(tx);

// Manage
sentrix.updateGuardrails({ maxSpendPerTx: 1.0 });
sentrix.getStatus(); // { killed, recentSpend, guardrails }
sentrix.disconnect();
```

---

## Demo Script

The "holy shit" moment:

1. Dashboard shows agent running 20 min of normal Jupiter swaps — green, healthy
2. **Inject anomaly:** Agent tries to dump 100% balance into zero-liquidity token
3. **Dashboard flashes red** — risk score spikes, "POLICY VIOLATION: exceeds 25% limit"
4. **Auto-kill fires** — agent shows `AgentPausedError`, dashboard shows QUARANTINED
5. **"$12,847 saved"** counter updates
6. Show guardrails config — adjust limits, reactivate
7. Show SDK code — "5 lines to integrate"

---

## Revenue Model

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 10K monitored tx/month |
| **Growth** | $0.002/tx | Unlimited agents, email alerts |
| **Pro** | $0.0015/tx + $200/mo | Priority support, custom rules |
| **Enterprise** | $3K+/mo | SLA, dedicated infra, SSO |

---

## Why Solana

- **400ms block times** = too fast for human-in-the-loop oversight
- **15M+ agent transactions** and growing exponentially
- **Agent frameworks** (ElizaOS, Solana Agent Kit) have zero built-in monitoring
- **First-mover advantage** — no one owns agent observability on Solana yet

---

## Built With

- [Bun](https://bun.sh) — JavaScript runtime
- [Hono](https://hono.dev) — Web framework
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) — Solana SDK
- [Helius](https://helius.dev) — Enhanced Solana RPC + webhooks
- [React](https://react.dev) + [Vite](https://vitejs.dev) — Frontend
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Recharts](https://recharts.org) — Charts

---

## Team

Built for [Colosseum Frontier Hackathon](https://www.colosseum.org) (Apr–May 2026).

---

## License

MIT
