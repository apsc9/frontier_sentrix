# sentrix-solana-sdk

AI agent observability SDK for Solana. Monitor, audit, and kill-switch autonomous agents transacting on-chain.

## Install

```bash
npm install sentrix-solana-sdk
```

## Quick Start

```typescript
import { SentrixClient } from 'sentrix-solana-sdk';
import { Keypair, Connection } from '@solana/web3.js';

const sentrix = new SentrixClient({
  serverUrl: 'https://your-sentrix-server.com',
  agentId: 'my-trading-agent',
  keypair: agentKeypair,
  connection: new Connection('https://api.devnet.solana.com'),
  guardrails: {
    maxSpendPerTx: 0.5,        // Max SOL per transaction
    hourlySpendLimit: 5,       // Max SOL per hour
    allowedPrograms: [          // Whitelisted program IDs
      '11111111111111111111111111111111',
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    ],
  },
});

// Replace connection.sendTransaction() with:
await sentrix.sendTransaction(transaction);
// Guardrails enforced. Events emitted. Kill switch respected.
```

## Features

- **Guardrails** — Per-tx spend limits, hourly caps, program allowlists
- **Kill Switch** — Instant agent freeze via WebSocket (manual or automatic)
- **Event Telemetry** — Every intent, send, confirm, block, and failure reported
- **Anomaly Detection** — Server-side spend velocity and unknown program detection
- **Zero Overhead** — Telemetry failures never block agent transactions

## API

### `SentrixClient`

```typescript
const sentrix = new SentrixClient(config: SentrixConfig);

await sentrix.sendTransaction(tx, options?);        // Send with guardrails
await sentrix.sendAndConfirmTransaction(tx, options?); // Send + await confirmation
sentrix.updateGuardrails({ maxSpendPerTx: 1.0 });   // Update limits
sentrix.getStatus();  // { killed, recentSpend, guardrails }
sentrix.disconnect(); // Cleanup WebSocket
```

### Errors

- `AgentPausedError` — Kill switch is active, all transactions blocked
- `GuardrailViolationError` — Transaction violates configured guardrails

## License

MIT
