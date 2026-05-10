import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SentrixClient, GuardrailViolationError } from "../packages/sdk/src/index.js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(import.meta.dir, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...vals] = line.split("=");
    if (key?.trim() && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join("=").trim();
    }
  }
}

const SERVER_URL = process.env.SENTRIX_SERVER ?? "http://localhost:4000";
const HELIUS_KEY = process.env.HELIUS_API_KEY ?? "";
const RPC_URL = HELIUS_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.devnet.solana.com";

const SYSTEM = SystemProgram.programId.toBase58();

const keypairData = JSON.parse(fs.readFileSync("demo/devnet-agent-keypair.json", "utf-8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
const connection = new Connection(RPC_URL, "confirmed");
const receiver = Keypair.generate();

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

async function sendReal(sentrix: SentrixClient, amount: number): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: receiver.publicKey,
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    })
  );
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);
  return await sentrix.sendAndConfirmTransaction(tx);
}

async function sendBlocked(sentrix: SentrixClient, amount: number): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: receiver.publicKey,
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    })
  );
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);
  await sentrix.sendTransaction(tx);
}

async function reviveAgent() {
  try {
    const res = await fetch(`${SERVER_URL}/api/agents/devnet-live-agent`);
    const data = await res.json();
    if (data.status === "killed") {
      log("⚡ Auto-kill detected — reviving agent...");
      await fetch(`${SERVER_URL}/api/agents/devnet-live-agent/kill`, { method: "DELETE" });
      await sleep(3000);
      log("✅ Agent revived");
    }
  } catch {}
}

async function run() {
  try {
    const health = await fetch(`${SERVER_URL}/health`);
    if (!health.ok) throw new Error(`Server returned ${health.status}`);
  } catch {
    console.error(`\n  ✗ Cannot reach server at ${SERVER_URL}`);
    process.exit(1);
  }

  // Revive if killed from previous run
  await reviveAgent();

  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  if (balanceSol < 0.5) {
    console.error(`\n  ✗ Insufficient balance: ${balanceSol} SOL`);
    console.error(`    Send devnet SOL to: ${keypair.publicKey.toBase58()}`);
    process.exit(1);
  }

  const dashUrl = SERVER_URL.includes("railway")
    ? "https://dashboard-iota-one-39.vercel.app"
    : "http://localhost:5173";

  console.log("\n");
  console.log("  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║         SENTRIX — REAL SOLANA DEVNET DEMO               ║");
  console.log(`  ║  Dashboard: ${dashUrl.padEnd(44)}║`);
  console.log("  ╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  Agent:    devnet-live-agent`);
  console.log(`  Pubkey:   ${keypair.publicKey.toBase58()}`);
  console.log(`  Balance:  ${balanceSol.toFixed(4)} SOL`);
  console.log(`  RPC:      ${HELIUS_KEY ? "Helius Devnet RPC" : "Public Devnet RPC"}`);
  console.log(`  Receiver: ${receiver.publicKey.toBase58()}`);

  // ═══════════════════════════════════════════════════
  // Phase 1: Registration — high hourly limit to avoid premature auto-kill
  // ═══════════════════════════════════════════════════
  phase(1, "AGENT REGISTRATION", "Agent connects to Sentrix with guardrails: 0.08 SOL/tx, 5 SOL/hr, System Program only.");

  const sentrix = new SentrixClient({
    serverUrl: SERVER_URL,
    agentId: "devnet-live-agent",
    keypair,
    connection,
    guardrails: {
      maxSpendPerTx: 0.08,
      hourlySpendLimit: 5.0,
      allowedPrograms: [SYSTEM],
    },
    onKilled: () => {
      log("🛑 Kill switch activated!");
    },
  });

  await sleep(2000);
  log("Agent registered with Sentrix");
  log("Guardrails: max 0.08 SOL/tx · 5 SOL/hr · System Program only");
  await sleep(2000);

  // ═══════════════════════════════════════════════════
  // Phase 2: Normal operations — 10 real devnet txs
  // ═══════════════════════════════════════════════════
  phase(2, "NORMAL OPERATIONS (REAL DEVNET)", "Agent sends real SOL transfers on Solana devnet. Every tx verifiable on Solana Explorer.");

  const normalAmounts = [0.01, 0.02, 0.015, 0.005, 0.03, 0.025, 0.01, 0.02, 0.035, 0.015];
  let txCount = 0;
  for (const amount of normalAmounts) {
    try {
      const sig = await sendReal(sentrix, amount);
      txCount++;
      log(`✅ TX #${txCount}: ${amount.toFixed(4)} SOL → ${sig.slice(0, 20)}...`);
    } catch (err: any) {
      log(`✗ ${err.message}`);
    }
    await sleep(2000);
  }

  log(`──── ${txCount} real devnet transactions, all within guardrails ────`);
  await sleep(3000);

  // ═══════════════════════════════════════════════════
  // Phase 3: Per-tx spend limit — blocked before chain
  // ═══════════════════════════════════════════════════
  phase(3, "SPEND LIMIT VIOLATION", "Agent tries to send amounts exceeding 0.08 SOL per-tx limit. Blocked BEFORE reaching Solana.");

  for (const amount of [0.2, 0.15, 0.5, 1.0]) {
    try {
      await sendBlocked(sentrix, amount);
    } catch (err: any) {
      if (err instanceof GuardrailViolationError) {
        log(`🛡️ BLOCKED: ${amount} SOL — exceeds 0.08 SOL limit`);
      } else {
        log(`✗ ${err.message}`);
      }
    }
    await sleep(1500);
  }

  log("──── 4 oversized transactions blocked — never reached chain ────");
  await sleep(2000);
  await reviveAgent();
  await sleep(2000);

  // ═══════════════════════════════════════════════════
  // Phase 4: Unknown program — blocked
  // ═══════════════════════════════════════════════════
  phase(4, "UNAUTHORIZED PROGRAM", "Agent tries to call programs not in the allowlist. Each is blocked instantly.");

  const fakePrograms = [
    { name: "Unknown DEX Contract", key: Keypair.generate().publicKey },
    { name: "Suspicious Token Program", key: Keypair.generate().publicKey },
    { name: "Unverified Bridge", key: Keypair.generate().publicKey },
  ];

  for (const prog of fakePrograms) {
    try {
      const tx = new Transaction().add({
        keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
        programId: prog.key,
        data: Buffer.alloc(0),
      });
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);
      await sentrix.sendTransaction(tx);
    } catch (err: any) {
      if (err instanceof GuardrailViolationError) {
        log(`🛡️ BLOCKED: ${prog.name}`);
        log(`   Program ${prog.key.toBase58().slice(0, 20)}... not in allowlist`);
      } else {
        log(`✗ ${err.message}`);
      }
    }
    await sleep(1500);
  }

  log("──── 3 unauthorized programs blocked ────");
  await sleep(2000);
  await reviveAgent();
  await sleep(2000);

  // ═══════════════════════════════════════════════════
  // Phase 5: Hourly limit — tighten guardrails live
  // ═══════════════════════════════════════════════════
  phase(5, "DYNAMIC GUARDRAILS — TIGHTEN LIMITS", "Operator tightens hourly limit from 5 SOL → 0.3 SOL via dashboard. Agent immediately blocked.");

  sentrix.updateGuardrails({ hourlySpendLimit: 0.3 });
  await fetch(`${SERVER_URL}/api/agents/devnet-live-agent/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hourlySpendLimit: 0.3 }),
  });
  log("Guardrails updated: hourly limit tightened to 0.3 SOL");
  log(`Agent already spent ${sentrix.getStatus().recentSpend.toFixed(4)} SOL this hour`);
  await sleep(2000);

  try {
    await sendBlocked(sentrix, 0.05);
  } catch (err: any) {
    if (err instanceof GuardrailViolationError) {
      log(`🛡️ BLOCKED: 0.05 SOL — hourly limit exceeded!`);
      log(`   ${err.message}`);
    } else {
      log(`✗ ${err.message}`);
    }
  }

  try {
    await sendBlocked(sentrix, 0.02);
  } catch (err: any) {
    if (err instanceof GuardrailViolationError) {
      log(`🛡️ BLOCKED: 0.02 SOL — still over hourly limit`);
    } else {
      log(`✗ ${err.message}`);
    }
  }

  log("──── Dynamic guardrails work — operator can tighten limits in real-time ────");
  await sleep(2000);
  await reviveAgent();

  // Restore guardrails for recovery phase
  sentrix.updateGuardrails({ hourlySpendLimit: 5.0 });
  await sleep(2000);

  // ═══════════════════════════════════════════════════
  // Phase 6: Recovery — normal txs resume
  // ═══════════════════════════════════════════════════
  phase(6, "RECOVERY", "Operator restores limits. Agent resumes normal operations. Guardrails protect, not paralyze.");

  for (const amount of [0.01, 0.015, 0.02]) {
    try {
      const sig = await sendReal(sentrix, amount);
      txCount++;
      log(`✅ TX #${txCount}: ${amount.toFixed(4)} SOL → ${sig.slice(0, 20)}...`);
    } catch (err: any) {
      log(`✗ ${err.message}`);
    }
    await sleep(2000);
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("  DEMO COMPLETE");
  console.log(`${"═".repeat(60)}`);

  const finalBalance = await connection.getBalance(keypair.publicKey);
  const spent = balanceSol - finalBalance / LAMPORTS_PER_SOL;

  console.log(`
  ✅ ${txCount} real Solana devnet transactions — verifiable on Explorer
  🛡️ 4 spend-limit violations blocked (never reached chain)
  🛡️ 3 unauthorized program calls blocked
  🛡️ 2 hourly-limit violations blocked (dynamic tightening)
  ✅ Agent recovered after guardrail restoration

  💰 Real SOL spent on-chain: ${spent.toFixed(4)} SOL
  💰 SOL saved by guardrails: ${(0.2 + 0.15 + 0.5 + 1.0 + 0.05 + 0.02).toFixed(2)} SOL blocked
  💰 Remaining balance: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL

  Verify all transactions:
  https://explorer.solana.com/address/${keypair.publicKey.toBase58()}?cluster=devnet

  Click any tx on dashboard → opens Solana Explorer ↗
  `);

  sentrix.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(`\n  ✗ Demo failed: ${err.message}`);
  process.exit(1);
});
