import {
  type Connection,
  type Keypair,
  type SendOptions,
  type TransactionSignature,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { nanoid } from "nanoid";
import type { SentrixConfig, GuardrailsConfig, AgentEvent, SentrixTransaction } from "./types.js";
import { checkGuardrails } from "./guardrails.js";
import { KillSwitch } from "./kill-switch.js";

export class AgentPausedError extends Error {
  constructor(reason?: string) {
    super(`Agent paused by Sentrix kill switch${reason ? `: ${reason}` : ""}`);
    this.name = "AgentPausedError";
  }
}

export class GuardrailViolationError extends Error {
  constructor(reason: string) {
    super(`Guardrail violation: ${reason}`);
    this.name = "GuardrailViolationError";
  }
}

export class SentrixClient {
  readonly connection: Connection;
  readonly keypair: Keypair;
  private serverUrl: string;
  private agentId: string;
  private guardrails: GuardrailsConfig;
  private killSwitch: KillSwitch;
  private recentSpend: number = 0;
  private spendWindow: { amount: number; timestamp: number }[] = [];

  constructor(config: SentrixConfig) {
    this.connection = config.connection;
    this.keypair = config.keypair;
    this.serverUrl = config.serverUrl.replace(/\/$/, "");
    this.agentId = config.agentId;
    this.guardrails = config.guardrails ?? {
      maxSpendPerTx: 0,
      hourlySpendLimit: 0,
      allowedPrograms: [],
    };

    this.killSwitch = new KillSwitch(
      this.serverUrl,
      this.agentId,
      config.onKilled
    );

    this.killSwitch.connect();
    this.registerAgent();
  }

  async sendTransaction(
    tx: SentrixTransaction,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    if (this.killSwitch.isKilled) {
      const state = this.killSwitch.currentState;
      await this.emitEvent("tx_blocked", {
        reason: "kill_switch_active",
        killReason: state.reason,
      });
      throw new AgentPausedError(state.reason);
    }

    this.pruneSpendWindow();
    const check = checkGuardrails(tx, this.guardrails, this.recentSpend);

    await this.emitEvent("tx_intent", {
      programIds: check.programIds,
      estimatedSol: check.estimatedSol,
      instructionCount: check.programIds.length,
    });

    if (!check.allowed) {
      await this.emitEvent("guardrail_violation", {
        reason: check.reason,
        programIds: check.programIds,
        estimatedSol: check.estimatedSol,
      });
      throw new GuardrailViolationError(check.reason!);
    }

    try {
      const signature = await this.connection.sendTransaction(
        tx as any,
        options
      );

      this.recordSpend(check.estimatedSol);

      await this.emitEvent("tx_sent", {
        signature,
        programIds: check.programIds,
        estimatedSol: check.estimatedSol,
      });

      return signature;
    } catch (err) {
      await this.emitEvent("tx_failed", {
        error: err instanceof Error ? err.message : String(err),
        programIds: check.programIds,
      });
      throw err;
    }
  }

  async sendAndConfirmTransaction(
    tx: SentrixTransaction,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const signature = await this.sendTransaction(tx, options);

    const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      await this.emitEvent("tx_failed", {
        signature,
        error: JSON.stringify(confirmation.value.err),
      });
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    await this.emitEvent("tx_confirmed", { signature });
    return signature;
  }

  updateGuardrails(config: Partial<GuardrailsConfig>): void {
    this.guardrails = { ...this.guardrails, ...config };
  }

  getStatus(): { killed: boolean; recentSpend: number; guardrails: GuardrailsConfig } {
    this.pruneSpendWindow();
    return {
      killed: this.killSwitch.isKilled,
      recentSpend: this.recentSpend,
      guardrails: { ...this.guardrails },
    };
  }

  disconnect(): void {
    this.killSwitch.disconnect();
  }

  private recordSpend(amount: number): void {
    this.spendWindow.push({ amount, timestamp: Date.now() });
    this.recentSpend += amount;
  }

  private pruneSpendWindow(): void {
    const oneHourAgo = Date.now() - 3600_000;
    this.spendWindow = this.spendWindow.filter((s) => s.timestamp > oneHourAgo);
    this.recentSpend = this.spendWindow.reduce((sum, s) => sum + s.amount, 0);
  }

  private async emitEvent(type: AgentEvent["type"], data: Record<string, unknown>): Promise<void> {
    const event: AgentEvent = {
      id: nanoid(),
      agentId: this.agentId,
      type,
      timestamp: Date.now(),
      data,
    };

    try {
      await fetch(`${this.serverUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {
      // Don't block agent on telemetry failure
    }
  }

  private async registerAgent(): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.agentId,
          pubkey: this.keypair.publicKey.toBase58(),
          config: this.guardrails,
        }),
      });
    } catch {
      // Non-fatal
    }
  }
}
