/**
 * Root-Cause Deep Structural Response Unwrapper
 * Eliminates response field volatility across all frontier model gateways by recursively
 * unwrapping completion and reasoning text from every possible field.
 *
 * NO UI-layer masking, NO fake fallback strings. If response is empty or corrupt, throws a hard error.
 */

export interface UnwrappedInferenceResult {
  content: string;
  reasoning?: string;
  toolCalls?: Array<{
    id?: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export function parseInferenceResponse(data: any): UnwrappedInferenceResult {
  if (!data) {
    throw new Error("Invalid inference response: payload is null or undefined");
  }

  const choice = data.choices?.[0] || data.choice || data;
  const message = choice.message || choice.delta || {};

  // 1. Extract content across all known fields
  let content = "";
  if (typeof message.content === "string" && message.content.trim().length > 0) {
    content = message.content.trim();
  } else if (typeof data.content === "string" && data.content.trim().length > 0) {
    content = data.content.trim();
  } else if (typeof data.output === "string" && data.output.trim().length > 0) {
    content = data.output.trim();
  }

  // 2. Extract reasoning across all known fields
  let reasoning: string | undefined = undefined;
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim().length > 0) {
    reasoning = message.reasoning_content.trim();
  } else if (typeof message.reasoning === "string" && message.reasoning.trim().length > 0) {
    reasoning = message.reasoning.trim();
  } else if (typeof choice.reasoning_content === "string" && choice.reasoning_content.trim().length > 0) {
    reasoning = choice.reasoning_content.trim();
  } else if (typeof data.reasoning === "string" && data.reasoning.trim().length > 0) {
    reasoning = data.reasoning.trim();
  }

  // If content is empty but reasoning exists, promotion
  if (!content && reasoning) {
    content = reasoning;
  }

  // 3. Extract tool calls
  const rawToolCalls = message.tool_calls || choice.tool_calls || data.tool_calls;
  let toolCalls: UnwrappedInferenceResult["toolCalls"] = undefined;

  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    toolCalls = rawToolCalls.map((tc: any) => ({
      id: tc.id || `tc_${Date.now()}`,
      type: "function" as const,
      function: {
        name: String(tc.function?.name || tc.name || "").replace(/^default_api:/, ""),
        arguments: typeof tc.function?.arguments === "string"
          ? tc.function.arguments
          : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
      },
    }));
  }

  // If both content and toolCalls are missing, throw a hard error to trigger model failover
  if (!content && (!toolCalls || toolCalls.length === 0)) {
    throw new Error("Inference response contains blank content and zero tool calls. Tripping failover.");
  }

  return {
    content,
    reasoning,
    toolCalls,
  };
}
