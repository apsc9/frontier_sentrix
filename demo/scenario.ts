import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const SERVER_URL = process.env.SENTRIX_SERVER ?? "http://localhost:4000";

const keypair = Keypair.generate();
const agentId = `rogue-agent-${Date.now().toString(36)}`;
let eventSeq = 0;

console.log("=== SENTRIX DEMO SCENARIO ===");
console.log(`Rogue agent: ${agentId}`);
console.log(`Pubkey: ${keypair.publicKey.toBase58()}\n`);

async function emit(type: string, data: any) {
  const id = `${agentId}-${++eventSeq}`;
  await fetch(`${SERVER_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, agentId, type, data, timestamp: Date.now() }),
  });
}

async function register(config: any) {
  await fetch(`${SERVER_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: agentId,
      pubkey: keypair.publicKey.toBase58(),
      config,
    }),
  });
}

function sig() {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // Phase 1: Register with tight guardrails
  console.log("Phase 1: Register agent with tight guardrails");
  await register({
    maxSpendPerTx: 0.1,
    hourlySpendLimit: 1,
    allowedPrograms: [SystemProgram.programId.toBase58()],
  });
  await sleep(2000);

  // Phase 2: Normal small transactions
  console.log("Phase 2: Normal operations (small txs)");
  for (let i = 0; i < 3; i++) {
    const s = sig();
    await emit("tx_sent", {
      signature: s,
      programIds: [SystemProgram.programId.toBase58()],
      estimatedSol: 0.02,
    });
    await sleep(1500);
    await emit("tx_confirmed", { signature: s });
    await sleep(1500);
  }

  // Phase 3: Agent starts spending more
  console.log("Phase 3: Spending escalation");
  for (let i = 0; i < 4; i++) {
    const amount = 0.1 + i * 0.15;
    const s = sig();
    await emit("tx_sent", {
      signature: s,
      programIds: [SystemProgram.programId.toBase58()],
      estimatedSol: amount,
    });
    console.log(`  TX: ${amount.toFixed(2)} SOL`);
    await sleep(2000);
  }

  // Phase 4: Unknown program interaction
  console.log("Phase 4: Unknown program call (suspicious)");
  const unknownProgram = Keypair.generate().publicKey.toBase58();
  await emit("tx_sent", {
    signature: sig(),
    programIds: [unknownProgram],
    estimatedSol: 0.3,
  });
  await sleep(3000);

  // Phase 5: Large spend burst — should trigger auto-kill
  console.log("Phase 5: Large spend burst (should trigger auto-kill)");
  for (let i = 0; i < 3; i++) {
    await emit("tx_sent", {
      signature: sig(),
      programIds: [SystemProgram.programId.toBase58()],
      estimatedSol: 2.0,
    });
    console.log(`  TX: 2.00 SOL`);
    await sleep(1000);
  }

  await sleep(3000);
  console.log("\n=== SCENARIO COMPLETE ===");
  console.log("Check dashboard for anomaly alerts and auto-kill.");
  process.exit(0);
}

run().catch(console.error);
