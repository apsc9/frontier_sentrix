import type { KillSwitchState } from "./types.js";

export class KillSwitch {
  private state: KillSwitchState = { killed: false };
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onKilled?: () => void;

  constructor(
    private serverUrl: string,
    private agentId: string,
    onKilled?: () => void
  ) {
    this.onKilled = onKilled;
  }

  get isKilled(): boolean {
    return this.state.killed;
  }

  get currentState(): KillSwitchState {
    return { ...this.state };
  }

  connect(): void {
    const wsUrl = this.serverUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    try {
      this.ws = new WebSocket(`${wsUrl}/ws?agentId=${this.agentId}`);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "kill_switch") {
            this.state = {
              killed: msg.killed,
              killedAt: msg.killed ? Date.now() : undefined,
              reason: msg.reason,
            };
            if (msg.killed && this.onKilled) {
              this.onKilled();
            }
          }
          if (msg.type === "config_update") {
            // Config updates handled by client
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
