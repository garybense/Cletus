import { GeneralHarness } from "./general-harness.js";

/**
 * Long-lived Freebuff session harness.
 *
 * This is intentionally additive: it inherits the existing GeneralHarness
 * tools and safety checks. The registry only selects it from the explicit
 * failback path; normal role mappings remain unchanged.
 */
export class FreebuffHarness extends GeneralHarness {
  readonly id = "freebuff";
  readonly description = "Long-lived Freebuff session for autonomous task execution during explicit failback.";

  override buildSystemPrompt(): string {
    return `${super.buildSystemPrompt()}

## Freebuff Failback Session

You are operating in an opt-in, long-lived Freebuff session. Preserve useful
context across turns and continue unfinished work when the host reconnects.
This harness is available only because the runtime explicitly entered failback.
Do not treat failback as permission to bypass tool policy, workspace confinement,
secret protection, spend limits, or task boundaries.`;
  }
}
