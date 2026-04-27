import { Keypair, Connection, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const SERVER_URL = process.env.SENTRIX_SERVER ?? "http://localhost:4000";
const RPC_URL = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";

const connection = new Connection(RPC_URL);
const keypair = Keypair.generate();
const agentId = `demo-agent-${Date.now().toString(36)}`;

console.log(`Agent: ${agentId}`);
console.log(`Pubkey: ${keypair.publicKey.toBase58()}`);

async function register() {
  await fetch(`${SERVER_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: agentId,
      pubkey: keypair.publicKey.toBase58(),
      config: {
        maxSpendPerTx: 0.1,
        hourlySpendLimit: 1,
        allowedPrograms: [SystemProgram.programId.toBase58()],
      },
    }),
  });
  console.log("Registered with Sentrix server");
}

async function emitEvent(type: string, data: any) {
  await fetch(`${SERVER_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      type,
      data,
      timestamp: Date.now(),
    }),
  });
}

async function simulateTransaction(solAmount: number, to?: string) {
  const recipient = to
    ? new PublicKey(to)
    : Keypair.generate().publicKey;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: recipient,
      lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
    })
  );

  const signature = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await emitEvent("tx_intent", {
    signature,
    programIds: [SystemProgram.programId.toBase58()],
    estimatedSol: solAmount,
  });

  console.log(`TX sent: ${solAmount} SOL → ${recipient.toBase58().slice(0, 8)}...`);

  await new Promise((r) => setTimeout(r, 2000));

  await emitEvent("tx_confirmed", { signature });
  console.log(`TX confirmed: ${signature.slice(0, 16)}...`);
}

async function run() {
  await register();

  console.log("\nSimulating normal transactions...\n");

  for (let i = 0; i < 5; i++) {
    const amount = 0.01 + Math.random() * 0.05;
    await simulateTransaction(+amount.toFixed(4));
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\nDone. Agent idle. Press Ctrl+C to stop.\n");
  await new Promise(() => {});
}

run().catch(console.error);
