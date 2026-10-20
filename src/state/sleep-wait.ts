import type BetterSqlite3 from "better-sqlite3";
import { consumeNextWakeEvent } from "./database.js";
import { agentEventBus } from "./event-bus.js";
import type { WakeEventRow } from "../types.js";

export async function waitForWakeEventOrTimeout(
  rawDb: BetterSqlite3.Database,
  maxWaitMs: number,
): Promise<WakeEventRow | { source: string; reason: string } | null> {
  const existing = consumeNextWakeEvent(rawDb);
  if (existing) {
    return existing;
  }

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const onWake = () => {
      cleanup();
      const event = consumeNextWakeEvent(rawDb);
      resolve(event || { source: "event_bus", reason: "wake_signal" });
    };

    const onTimeout = () => {
      cleanup();
      const event = consumeNextWakeEvent(rawDb);
      resolve(event || null);
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      agentEventBus.off("wake_requested", onWake);
      agentEventBus.off("work_available", onWake);
    };

    agentEventBus.once("wake_requested", onWake);
    agentEventBus.once("work_available", onWake);
    timer = setTimeout(onTimeout, maxWaitMs);
  });
}
