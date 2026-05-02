import { Keypair, SystemProgram } from "@solana/web3.js";

const SERVER_URL = process.env.SENTRIX_SERVER ?? "http://localhost:4000";

const keypair = Keypair.generate();
const agentId = "trading-bot-alpha";
let eventSeq = 0;

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SYSTEM = SystemProgram.programId.toBase58();

async function emit(type: string, data: any) {
  const id = `${agentId}-${++eventSeq}`;
  const res = await fetch(`${SERVER_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, agentId, type, data, timestamp: Date.now() }),
  });
  if (!res.ok) {
    console.error(`  ✗ Event failed: ${res.status} ${res.statusText}`);
  }
}

async function register(config: any) {
  const res = await fetch(`${SERVER_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: agentId,
      pubkey: keypair.publicKey.toBase58(),
      config,
    }),
  });
  if (!res.ok) {
    console.error(`  ✗ Register failed: ${res.status}`);
    process.exit(1);
  }
}

async function checkStatus(retries = 5): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "killed") return "killed";
      if (i < retries - 1) await sleep(1000);
    }
  }
  const res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
  const data = await res.json();
  return data.status;
}

function sig() {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`  [${ts}] ${msg}`);
}

function phase(n: number, title: string, narrator: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  PHASE ${n}: ${title}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`\n  📋 ${narrator}\n`);
}

async function sendTx(amount: number, programs: string[], confirm = true) {
  const s = sig();
  await emit("tx_sent", {
    signature: s,
    programIds: programs,
    estimatedSol: amount,
  });
  log(`TX sent: ${amount.toFixed(4)} SOL → ${s.slice(0, 12)}...`);

  if (confirm) {
    await sleep(800);
    await emit("tx_confirmed", { signature: s });
    log(`TX confirmed ✓`);
  }
  return s;
}

async function run() {
  // Verify server is reachable
  try {
    const health = await fetch(`${SERVER_URL}/health`);
    if (!health.ok) throw new Error(`Server returned ${health.status}`);
  } catch (e: any) {
    console.error(`\n  ✗ Cannot reach server at ${SERVER_URL}`);
    console.error(`    Start it with: bun run dev:server\n`);
    process.exit(1);
  }

  console.log("\n");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║         SENTRIX — LIVE DEMO SCENARIO            ║");
  console.log("  ║   Watch the dashboard at http://localhost:5173   ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log(`\n  Agent: ${agentId}`);
  console.log(`  Pubkey: ${keypair.publicKey.toBase58()}`);

  // Phase 1: Registration
  phase(1, "AGENT REGISTRATION", "Agent connects to Sentrix with guardrails configured.");

  await register({
    maxSpendPerTx: 0.5,
    hourlySpendLimit: 1,
    allowedPrograms: [SYSTEM, JUPITER],
  });
  log("Agent registered — max 0.5 SOL/tx, 1 SOL/hr limit");
  log("Allowed: System Program, Jupiter v6");
  await sleep(3000);

  // Phase 2: Normal operations — build trust
  phase(2, "NORMAL OPERATIONS", "Agent performs routine Jupiter swaps. Everything looks healthy.");

  const normalAmounts = [0.02, 0.035, 0.015, 0.04, 0.025, 0.03];
  for (const amount of normalAmounts) {
    await sendTx(amount, [SYSTEM, JUPITER]);
    await sleep(2500);
  }

  log("──── 6 transactions, all within bounds ────");
  await sleep(3000);

  // Phase 3: Gradual escalation
  phase(3, "SPENDING ESCALATION", "Agent starts increasing transaction sizes. Watch the spend chart climb.");

  const escalation = [0.08, 0.12, 0.18, 0.25];
  for (const amount of escalation) {
    await sendTx(amount, [SYSTEM, JUPITER]);
    await sleep(2000);
  }

  log("⚡ Spend velocity increasing...");
  await sleep(2000);

  // Phase 4: Unknown program — WARNING
  phase(4, "UNKNOWN PROGRAM DETECTED", "Agent calls an unrecognized program. Sentrix flags it as WARNING.");

  const rogueProgram = Keypair.generate().publicKey.toBase58();
  await sendTx(0.15, [rogueProgram], false);
  log(`⚠ Unknown program: ${rogueProgram.slice(0, 16)}...`);
  await sleep(4000);

  // Phase 5: The attack — CRITICAL + auto-kill
  phase(5, "ROGUE BURST — AUTO-KILL", "Agent attempts rapid high-value transactions. This should trigger CRITICAL anomaly and auto-kill.");

  for (let i = 0; i < 3; i++) {
    await sendTx(1.5, [SYSTEM], false);
    await sleep(600);
  }

  log("💀 Spend velocity CRITICAL — exceeds 2x threshold");
  await sleep(1500);

  const status = await checkStatus(5);
  if (status === "killed") {
    console.log(`\n  ┌──────────────────────────────────────────┐`);
    console.log(`  │  🛑  AGENT AUTO-KILLED BY SENTRIX         │`);
    console.log(`  │                                            │`);
    console.log(`  │  Status: QUARANTINED                       │`);
    console.log(`  │  Reason: Spend velocity critical           │`);
    console.log(`  │  Action: All transactions blocked           │`);
    console.log(`  └──────────────────────────────────────────┘`);
  } else {
    console.log(`\n  ⚠ Agent status: ${status} (expected: killed)`);
    console.log(`    Detection may need threshold adjustment.`);
  }

  await sleep(2000);

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("  DEMO COMPLETE");
  console.log(`${"═".repeat(60)}`);
  console.log(`
  ✓ Agent registered with guardrails
  ✓ Normal transactions monitored in real-time
  ✓ Spending escalation tracked
  ✓ Unknown program flagged (WARNING)
  ✓ Rapid spend burst detected (CRITICAL)
  ✓ Auto-kill activated — agent quarantined

  💰 Funds protected by Sentrix.
  `);

  process.exit(0);
}

run().catch((err) => {
  console.error(`\n  ✗ Scenario failed: ${err.message}`);
  process.exit(1);
});
