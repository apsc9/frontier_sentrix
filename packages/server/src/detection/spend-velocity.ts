import { getDb } from "../db/schema.js";

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_THRESHOLD_SOL = 5;

export interface SpendVelocityResult {
  isAnomaly: boolean;
  currentSpend: number;
  threshold: number;
  windowMinutes: number;
}

export function checkSpendVelocity(
  agentId: string,
  thresholdSol: number = DEFAULT_THRESHOLD_SOL
): SpendVelocityResult {
  const db = getDb();
  const since = Date.now() - WINDOW_MS;

  const row = db
    .query<{ total: number }, [string, number]>(
      `SELECT COALESCE(SUM(estimated_sol), 0) as total
       FROM transactions
       WHERE agent_id = ? AND timestamp > ? AND status != 'blocked'`
    )
    .get(agentId, since);

  const currentSpend = row?.total ?? 0;

  return {
    isAnomaly: currentSpend > thresholdSol,
    currentSpend,
    threshold: thresholdSol,
    windowMinutes: 5,
  };
}
