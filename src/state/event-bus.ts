import { EventEmitter } from "events";

export interface WorkAvailablePayload {
  itemId: string;
  source: string;
  priority?: number;
}

export interface WakeRequestedPayload {
  source: string;
  reason: string;
  payload?: Record<string, unknown>;
}

export class AgentEventBus extends EventEmitter {
  emitWorkAvailable(payload: WorkAvailablePayload): boolean {
    return this.emit("work_available", payload);
  }

  emitWakeRequested(payload: WakeRequestedPayload): boolean {
    return this.emit("wake_requested", payload);
  }
}

export const agentEventBus = new AgentEventBus();
agentEventBus.setMaxListeners(50);
