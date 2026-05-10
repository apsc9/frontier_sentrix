import { nanoid } from "nanoid";
import { getDb } from "../db/schema.js";
import { broadcast } from "../ws/hub.js";
import { checkSpendVelocity } from "./spend-velocity.js";
import { checkPrograms } from "./program-check.js";

export interface DetectionContext {
  agentId: string;
  programIds: string[];
  estimatedSol: number;
  allowedPrograms: string[];
  spendThreshold: number;
  maxSpendPerTx?: number;
  wasBlocked?: boolean;
  blockReason?: string;
}

export function runDetection(ctx: DetectionContext): void {
  const db = getDb();

  const velocity = checkSpendVelocity(ctx.agentId, ctx.spendThreshold);
  if (velocity.isAnomaly) {
    const anomaly = {
      id: nanoid(),
      agent_id: ctx.agentId,
      type: "spend_velocity",
      severity: velocity.currentSpend > ctx.spendThreshold * 2 ? "CRITICAL" : "WARNING",
      details: JSON.stringify({
        currentSpend: velocity.currentSpend,
        threshold: velocity.threshold,
        windowMinutes: velocity.windowMinutes,
      }),
      timestamp: Date.now(),
    };

    db.query(
      `INSERT INTO anomalies (id, agent_id, type, severity, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(anomaly.id, anomaly.agent_id, anomaly.type, anomaly.severity, anomaly.details, anomaly.timestamp);

    broadcast({
      type: "anomaly",
      anomaly: { ...anomaly, details: JSON.parse(anomaly.details) },
    });

    if (anomaly.severity === "CRITICAL") {
      autoKill(db, ctx.agentId, `Spend velocity critical: ${velocity.currentSpend} SOL in ${velocity.windowMinutes}min`);
    }
  }

  if (ctx.wasBlocked && ctx.blockReason) {
    const anomaly = {
      id: nanoid(),
      agent_id: ctx.agentId,
      type: "guardrail_violation",
      severity: "WARNING" as const,
      details: JSON.stringify({
        reason: ctx.blockReason,
        estimatedSol: ctx.estimatedSol,
        maxSpendPerTx: ctx.maxSpendPerTx,
      }),
      timestamp: Date.now(),
    };

    db.query(
      `INSERT INTO anomalies (id, agent_id, type, severity, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(anomaly.id, anomaly.agent_id, anomaly.type, anomaly.severity, anomaly.details, anomaly.timestamp);

    broadcast({
      type: "anomaly",
      anomaly: { ...anomaly, details: JSON.parse(anomaly.details) },
    });
  }

  const programCheck = !ctx.wasBlocked ? checkPrograms(ctx.programIds, ctx.allowedPrograms) : null;
  if (programCheck?.isAnomaly) {
    const anomaly = {
      id: nanoid(),
      agent_id: ctx.agentId,
      type: "unknown_program",
      severity: "WARNING" as const,
      details: JSON.stringify({
        unknownPrograms: programCheck.unknownPrograms,
        allPrograms: programCheck.allPrograms,
      }),
      timestamp: Date.now(),
    };

    db.query(
      `INSERT INTO anomalies (id, agent_id, type, severity, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(anomaly.id, anomaly.agent_id, anomaly.type, anomaly.severity, anomaly.details, anomaly.timestamp);

    broadcast({
      type: "anomaly",
      anomaly: { ...anomaly, details: JSON.parse(anomaly.details) },
    });
  }
}

function autoKill(db: ReturnType<typeof getDb>, agentId: string, reason: string): void {
  db.query(
    `UPDATE agents SET status = 'killed', updated_at = ? WHERE id = ?`
  ).run(Date.now(), agentId);

  broadcast({
    type: "kill_switch",
    agentId,
    killed: true,
    reason,
    auto: true,
  });
}
