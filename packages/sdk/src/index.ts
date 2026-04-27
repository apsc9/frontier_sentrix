export { SentrixClient, AgentPausedError, GuardrailViolationError } from "./client.js";
export { checkGuardrails } from "./guardrails.js";
export { KillSwitch } from "./kill-switch.js";

export type {
  SentrixConfig,
  GuardrailsConfig,
  AgentEvent,
  EventType,
  TransactionIntent,
  AnomalyAlert,
  AnomalyType,
  KillSwitchState,
  SentrixTransaction,
} from "./types.js";
