import type { Keypair, Connection, TransactionSignature, VersionedTransaction, Transaction } from "@solana/web3.js";

export interface SentrixConfig {
  serverUrl: string;
  agentId: string;
  keypair: Keypair;
  connection: Connection;
  guardrails?: GuardrailsConfig;
  onKilled?: () => void;
}

export interface GuardrailsConfig {
  maxSpendPerTx: number;
  hourlySpendLimit: number;
  allowedPrograms: string[];
}

export interface AgentEvent {
  id: string;
  agentId: string;
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type EventType =
  | "tx_intent"
  | "tx_sent"
  | "tx_confirmed"
  | "tx_blocked"
  | "tx_failed"
  | "anomaly_detected"
  | "kill_switch_activated"
  | "kill_switch_deactivated"
  | "guardrail_violation";

export interface TransactionIntent {
  agentId: string;
  signature?: string;
  programIds: string[];
  estimatedSol: number;
  instructionCount: number;
  timestamp: number;
}

export interface AnomalyAlert {
  id: string;
  agentId: string;
  type: AnomalyType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  details: string;
  timestamp: number;
}

export type AnomalyType =
  | "spend_velocity"
  | "unknown_program"
  | "large_transaction"
  | "failed_tx_spike";

export type KillSwitchState = {
  killed: boolean;
  killedAt?: number;
  reason?: string;
};

export type SentrixTransaction = Transaction | VersionedTransaction;
