import type { InferenceClient, InferenceToolCall } from "../types.js";
import type { WorkerInferenceClient } from "./harness-types.js";

export function createWorkerInferenceBridge(
  inference: InferenceClient | { chat: (...args: any[]) => Promise<any> },
  getDefaultModel?: () => string,
): WorkerInferenceClient {
  return {
    chat: async (params) => {
      // If provided with the main agent InferenceClient (messages, tools, opts)
      if (
        typeof (inference as any).setLowComputeMode === "function" ||
        typeof (inference as any).getDefaultModel === "function"
      ) {
        const targetModel = getDefaultModel ? getDefaultModel() : "gemini-3.6-flash";
        const response = await (inference as InferenceClient).chat(
          params.messages,
          {
            model: targetModel,
            maxTokens: params.maxTokens,
            temperature: params.temperature,
            tools: params.tools as any,
          },
        );
        return {
          content: response.message.content || "",
          toolCalls: response.toolCalls as InferenceToolCall[] | undefined,
        };
      }

      // Legacy UnifiedInferenceClient path
      const response = await (inference as any).chat({
        tier: params.tier || "fast",
        messages: params.messages,
        tools: params.tools,
        toolChoice: params.toolChoice,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        responseFormat: params.responseFormat,
      });

      return {
        content: response.content || "",
        toolCalls: response.toolCalls as InferenceToolCall[] | undefined,
      };
    },
  };
}
