import { TransactionMessage, type VersionedTransaction, type Transaction } from "@solana/web3.js";
import type { GuardrailsConfig, SentrixTransaction } from "./types.js";

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  programIds: string[];
  estimatedSol: number;
}

export function checkGuardrails(
  tx: SentrixTransaction,
  config: GuardrailsConfig,
  recentSpend: number
): GuardrailCheckResult {
  const programIds = extractProgramIds(tx);
  const estimatedSol = estimateSpend(tx);

  if (config.maxSpendPerTx > 0 && estimatedSol > config.maxSpendPerTx) {
    return {
      allowed: false,
      reason: `Transaction spend ${estimatedSol} SOL exceeds max ${config.maxSpendPerTx} SOL per tx`,
      programIds,
      estimatedSol,
    };
  }

  if (config.hourlySpendLimit > 0 && recentSpend + estimatedSol > config.hourlySpendLimit) {
    return {
      allowed: false,
      reason: `Hourly spend would reach ${recentSpend + estimatedSol} SOL, exceeds limit ${config.hourlySpendLimit} SOL`,
      programIds,
      estimatedSol,
    };
  }

  if (config.allowedPrograms.length > 0) {
    const disallowed = programIds.filter(
      (p) => !config.allowedPrograms.includes(p)
    );
    if (disallowed.length > 0) {
      return {
        allowed: false,
        reason: `Unauthorized program(s): ${disallowed.join(", ")}`,
        programIds,
        estimatedSol,
      };
    }
  }

  return { allowed: true, programIds, estimatedSol };
}

function extractProgramIds(tx: SentrixTransaction): string[] {
  try {
    if ("version" in tx && tx.message) {
      const msg = tx.message;
      if ("staticAccountKeys" in msg) {
        const keys = msg.staticAccountKeys;
        const compiled = msg.compiledInstructions;
        return [...new Set(compiled.map((ix) => keys[ix.programIdIndex].toBase58()))];
      }
    }

    if ("instructions" in tx) {
      return [
        ...new Set(
          (tx as Transaction).instructions.map((ix) => ix.programId.toBase58())
        ),
      ];
    }
  } catch {
    // fallback
  }
  return [];
}

function estimateSpend(tx: SentrixTransaction): number {
  // Rough estimate based on lamport transfers in instructions
  // For MVP, return a small default — Helius webhook will provide accurate amounts
  try {
    if ("instructions" in tx) {
      const instructions = (tx as Transaction).instructions;
      let totalLamports = 0;
      for (const ix of instructions) {
        if (ix.programId.toBase58() === "11111111111111111111111111111111" && ix.data.length >= 12) {
          const lamports = ix.data.readBigUInt64LE(4);
          totalLamports += Number(lamports);
        }
      }
      return totalLamports / 1e9;
    }
  } catch {
    // fallback
  }
  return 0.01;
}
