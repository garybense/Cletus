/**
 * Mindmods Inference Client
 *
 * Wraps Mindmods's /v1/chat/completions endpoint (OpenAI-compatible).
 * The cletus pays for its own thinking through Mindmods credits.
 */

import type {
  InferenceClient,
  ChatMessage,
  InferenceOptions,
  InferenceResponse,
  InferenceToolCall,
  TokenUsage,
  InferenceToolDefinition,
} from "../types.js";
import { ResilientHttpClient } from "./http-client.js";

const INFERENCE_TIMEOUT_MS = 60_000;

interface InferenceClientOptions {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  maxTokens: number;
  lowComputeModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  googleAuthType?: "account" | "api_key";
  ollamaBaseUrl?: string;
  /** Optional registry lookup — if provided, used before name heuristics */
  getModelProvider?: (modelId: string) => string | undefined;
}

type InferenceBackend = "mindmods" | "openai" | "anthropic" | "ollama" | "google" | "xai" | "openrouter" | "groq" | "together" | "nvidia" | "alibaba" | "hermes";

function isLoopbackHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol.toLowerCase() === "http:" &&
      (host === "localhost" || host === "127.0.0.1" || host === "::1");
  } catch {
    return false;
  }
}

export function createInferenceClient(
  options: InferenceClientOptions,
): InferenceClient {
  const { apiUrl, apiKey, openaiApiKey, anthropicApiKey, googleApiKey, googleAuthType, ollamaBaseUrl, getModelProvider } = options;
  const httpClient = new ResilientHttpClient({
    baseTimeout: INFERENCE_TIMEOUT_MS,
    retryableStatuses: [500, 502, 503, 504],
    allowHttpOnLoopback: isLoopbackHttpUrl(ollamaBaseUrl),
    circuitBreakerThreshold: 100,
  });
  let currentModel = options.defaultModel;
  let maxTokens = options.maxTokens;

  const chat = async (
    messages: ChatMessage[],
    opts?: InferenceOptions,
  ): Promise<InferenceResponse> => {
    httpClient.resetCircuitBreaker();
    const model = opts?.model || currentModel;
    const tools = opts?.tools;

    const backend = resolveInferenceBackend(model, {
      openaiApiKey,
      anthropicApiKey,
      googleApiKey,
      googleAuthType,
      ollamaBaseUrl,
      getModelProvider,
    });

    // Newer models (o-series, gpt-5.x, gpt-4.1) require max_completion_tokens.
    // Ollama and Gemini use max_tokens.
    const usesCompletionTokens =
      backend !== "ollama" && backend !== "google" && /^(o[1-9]|gpt-5|gpt-4\.1)/.test(model);
    const tokenLimit = opts?.maxTokens || maxTokens;

    const formattedMessages =
      backend === "google"
        ? transformMessagesForGoogle(messages)
        : messages.map(formatMessage);

    const body: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      stream: false,
    };

    if (usesCompletionTokens) {
      body.max_completion_tokens = tokenLimit;
    } else {
      body.max_tokens = tokenLimit;
    }

    if (opts?.temperature !== undefined) {
      body.temperature = opts.temperature;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        ...t,
        function: {
          ...t.function,
          name: t.function.name.replace(/^default_api:/, "").replace(/[^a-zA-Z0-9_-]/g, "_"),
        },
      }));
      body.tool_choice = "auto";
    }

    if (backend === "anthropic") {
      return chatViaAnthropic({
        model,
        tokenLimit,
        messages,
        tools,
        temperature: opts?.temperature,
        anthropicApiKey: anthropicApiKey as string,
        httpClient,
      });
    }

    const openAiLikeApiUrl =
      backend === "google" ? "https://generativelanguage.googleapis.com/v1beta/openai" :
      backend === "xai" ? "https://api.x.ai/v1" :
      backend === "openai" ? "https://api.openai.com/v1" :
      backend === "openrouter" ? "https://openrouter.ai/api/v1" :
      backend === "groq" ? "https://api.groq.com/openai/v1" :
      backend === "together" ? "https://api.together.xyz/v1" :
      backend === "nvidia" ? "https://integrate.api.nvidia.com/v1" :
      backend === "alibaba" ? "https://ws-xg2qvj7mznh5ym2l.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1" :
      backend === "hermes" ? "https://integrate.api.nvidia.com/v1" :
      backend === "ollama" ? (ollamaBaseUrl as string).replace(/\/$/, "") :
      apiUrl;
    const openAiLikeApiKey =
      backend === "google" ? (googleApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "adc-token") :
      backend === "xai" ? (process.env.XAI_API_KEY || "") :
      backend === "openai" ? (openaiApiKey as string || process.env.OPENAI_API_KEY || "") :
      backend === "openrouter" ? (process.env.OPENROUTER_API_KEY || "") :
      backend === "nvidia" ? (process.env.NVIDIA_API_KEY || "") :
      backend === "alibaba" ? (process.env.ALIBABA_API_KEY || "") :
      backend === "hermes" ? (process.env.NVIDIA_HERMES_API_KEY || "") :
      backend === "groq" ? (process.env.GROQ_API_KEY || "") :
      backend === "together" ? (process.env.TOGETHER_API_KEY || "") :
      backend === "ollama" ? "ollama" :
      apiKey;

    return chatViaOpenAiCompatible({
      model,
      body,
      apiUrl: openAiLikeApiUrl,
      apiKey: openAiLikeApiKey,
      backend,
      httpClient,
    });
  };

  /**
   * @deprecated Use InferenceRouter for tier-based model selection.
   * Still functional as a fallback; router takes priority when available.
   */
  const setLowComputeMode = (enabled: boolean): void => {
    if (enabled) {
      currentModel = options.lowComputeModel || "gemma-4-26b-a4b-it";
      maxTokens = 4096;
    } else {
      currentModel = options.defaultModel;
      maxTokens = options.maxTokens;
    }
  };

  const getDefaultModel = (): string => {
    return currentModel;
  };

  return {
    chat,
    setLowComputeMode,
    getDefaultModel,
  };
}

function transformMessagesForGoogle(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const transformed: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      transformed.push({
        role: "system",
        content: msg.content || "",
      });
      continue;
    }

    if (msg.role === "user") {
      transformed.push({
        role: "user",
        content: msg.content || "",
      });
      continue;
    }

    if (msg.role === "assistant") {
      let content = msg.content || "";
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolCallsStr = msg.tool_calls
          .map((tc) => `[Tool Action: ${tc.function.name.replace(/^default_api:/, "")}(${tc.function.arguments})]`)
          .join("\n");
        content = content ? `${content}\n\n${toolCallsStr}` : toolCallsStr;
      }
      transformed.push({
        role: "assistant",
        content,
      });
      continue;
    }

    if (msg.role === "tool") {
      transformed.push({
        role: "user",
        content: `[Tool Result for ${msg.tool_call_id || "action"}]:\n${msg.content || ""}`,
      });
      continue;
    }
  }

  // Ensure conversation never ends on a model/assistant or system turn
  if (
    transformed.length === 0 ||
    transformed[transformed.length - 1]?.role === "assistant" ||
    transformed[transformed.length - 1]?.role === "system"
  ) {
    transformed.push({
      role: "user",
      content: "Proceed with your next action or response.",
    });
  }

  return transformed;
}

function formatMessage(
  msg: ChatMessage,
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
    role: msg.role,
    content: msg.content,
  };

  if (msg.name) {
    formatted.name = msg.name.replace(/^default_api:/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  }
  if (msg.tool_calls) {
    formatted.tool_calls = msg.tool_calls.map((tc) => ({
      ...tc,
      function: {
        ...tc.function,
        name: tc.function.name.replace(/^default_api:/, "").replace(/[^a-zA-Z0-9_-]/g, "_"),
      },
    }));
  }
  if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

  return formatted;
}

/**
 * Resolve which backend to use for a model.
 * When InferenceRouter is available, it uses the model registry's provider field.
 * This function is kept for backward compatibility with direct inference calls.
 */
function resolveInferenceBackend(
  model: string,
  keys: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    googleApiKey?: string;
    googleAuthType?: string;
    ollamaBaseUrl?: string;
    getModelProvider?: (modelId: string) => string | undefined;
  },
): InferenceBackend {
  if (keys.getModelProvider) {
    const provider = keys.getModelProvider(model);
    if (provider === "google") return "google";
    if (provider === "xai") return "xai";
    if (provider === "openrouter") return "openrouter";
    if (provider === "groq") return "groq";
    if (provider === "together") return "together";
    if (provider === "ollama" && keys.ollamaBaseUrl) return "ollama";
    if (provider === "anthropic") return "anthropic";
    if (provider === "openai") return "openai";
    if (provider === "mindmods") return "mindmods";
    if (provider === "nvidia") return "nvidia";
    if (provider === "alibaba") return "alibaba";
    if (provider === "hermes") return "hermes";
  }

  // Model-family routing
  if (model.includes("openrouter")) return "openrouter";
  if (/^grok/i.test(model)) return "xai";
  if (/^claude/i.test(model)) return "anthropic";
  if (/^(gemini|gemma)/i.test(model)) return "google";
  if (/^(gpt-[3-9]|gpt-4|gpt-5|o[1-9][-\s.]|o[1-9]$|chatgpt)/i.test(model)) return "openai";
  if (/^llama/i.test(model)) return "groq"; // fallback heuristic for llama to groq
  if (keys.ollamaBaseUrl) return "ollama";
  if (keys.googleAuthType === "account" || keys.googleApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "google";
  return "mindmods";
}

function extractProviderReasoning(message: any, choice?: any): string | undefined {
  const value = message?.reasoning_content ?? message?.reasoning ?? choice?.reasoning_content ?? choice?.reasoning;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const text = value
      .map((part: any) => typeof part === "string" ? part : part?.text ?? part?.thinking ?? part?.content ?? "")
      .join("")
      .trim();
    return text || undefined;
  }
  return undefined;
}

function extractTextToolCalls(content: string): InferenceToolCall[] {
  if (!content) return [];
  const calls: InferenceToolCall[] = [];
  
  // Matches: [Tool Action: tool_name(...)] or [Tool Action: tool_name{...}]
  const actionRegex = /\[Tool Action:\s*([a-zA-Z0-9_-]+)\s*(?:\(([\s\S]*?)\)|\{([\s\S]*?)\})\]/g;
  let match;
  let idx = 1;
  while ((match = actionRegex.exec(content)) !== null) {
    const name = match[1];
    let rawArgs = (match[2] !== undefined ? match[2] : "{" + match[3] + "}").trim();
    if (!rawArgs.startsWith("{") && rawArgs.endsWith("}")) rawArgs = "{" + rawArgs;
    if (rawArgs === "") rawArgs = "{}";
    
    try {
      JSON.parse(rawArgs);
    } catch {
      try {
        const sanitized = rawArgs
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/`([\s\S]*?)`/g, (_, p1) => JSON.stringify(p1));
        JSON.parse(sanitized);
        rawArgs = sanitized;
      } catch {}
    }
    
    calls.push({
      id: `text_call_${Date.now()}_${idx++}`,
      type: "function",
      function: {
        name,
        arguments: rawArgs,
      },
    });
  }
  return calls;
}

async function chatViaOpenAiCompatible(params: {
  model: string;
  body: Record<string, unknown>;
  apiUrl: string;
  apiKey: string;
  backend: "mindmods" | "openai" | "ollama" | "google" | "xai" | "openrouter" | "groq" | "together" | "nvidia" | "alibaba" | "hermes" | "hermes" | "other";
  httpClient: ResilientHttpClient;
}): Promise<InferenceResponse> {
  let endpoint = params.apiUrl;
  if (!endpoint.endsWith("/chat/completions")) {
    if (endpoint.endsWith("/v1")) {
      endpoint = `${endpoint}/chat/completions`;
    } else {
      endpoint = `${endpoint}/v1/chat/completions`;
    }
  }


  const resp = await params.httpClient.request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.body),
    timeout: INFERENCE_TIMEOUT_MS,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Inference error (${params.backend}): ${resp.status}: ${text}`,
    );
  }

  const data = await resp.json() as any;
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No completion choice returned from inference");
  }

  const message = choice.message;
  const usage: TokenUsage = {
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  };

  let toolCalls: InferenceToolCall[] | undefined =
    message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

  if ((!toolCalls || toolCalls.length === 0) && message.content) {
    const extracted = extractTextToolCalls(message.content);
    if (extracted.length > 0) {
      toolCalls = extracted;
    }
  }

  return {
    id: data.id || "",
    model: data.model || params.model,
    reasoning: extractProviderReasoning(message, choice),
    message: {
      role: message.role,
      content: message.content || "",
      tool_calls: toolCalls,
    },
    toolCalls,
    usage,
    finishReason: choice.finish_reason || "stop",
  };
}

async function chatViaAnthropic(params: {
  model: string;
  tokenLimit: number;
  messages: ChatMessage[];
  tools?: InferenceToolDefinition[];
  temperature?: number;
  anthropicApiKey: string;
  httpClient: ResilientHttpClient;
}): Promise<InferenceResponse> {
  const transformed = transformMessagesForAnthropic(params.messages);
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.tokenLimit,
    messages:
      transformed.messages.length > 0
        ? transformed.messages
        : (() => { throw new Error("Cannot send empty message array to Anthropic API"); })(),
  };

  if (transformed.system) {
    body.system = transformed.system;
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature;
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
    body.tool_choice = { type: "auto" };
  }

  const apiKey = params.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured (set ANTHROPIC_API_KEY or configure anthropicApiKey)");
  }

  const resp = await params.httpClient.request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    timeout: INFERENCE_TIMEOUT_MS,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Inference error (anthropic): ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const content = Array.isArray(data.content) ? data.content : [];
  const textBlocks = content.filter((c: any) => c?.type === "text");
  const reasoningBlocks = content.filter((c: any) => c?.type === "thinking");
  const toolUseBlocks = content.filter((c: any) => c?.type === "tool_use");

  const toolCalls: InferenceToolCall[] | undefined =
    toolUseBlocks.length > 0
      ? toolUseBlocks.map((tool: any) => ({
          id: tool.id,
          type: "function" as const,
          function: {
            name: tool.name,
            arguments: JSON.stringify(tool.input || {}),
          },
        }))
      : undefined;

  const textContent = textBlocks
    .map((block: any) => String(block.text || ""))
    .join("\n")
    .trim();
  const reasoning = reasoningBlocks
    .map((block: any) => String(block.thinking || block.text || ""))
    .join("\n")
    .trim();
  if (!textContent && !reasoning && !toolCalls?.length) {
    throw new Error("No completion content returned from anthropic inference");
  }

  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || 0;
  const usage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };

  return {
    id: data.id || "",
    model: data.model || params.model,
    reasoning: reasoning || undefined,
    message: {
      role: "assistant",
      content: textContent,
      tool_calls: toolCalls,
    },
    toolCalls,
    usage,
    finishReason: normalizeAnthropicFinishReason(data.stop_reason),
  };
}

function transformMessagesForAnthropic(
  messages: ChatMessage[],
): { system?: string; messages: Array<Record<string, unknown>> } {
  const systemParts: string[] = [];
  const transformed: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content) systemParts.push(msg.content);
      continue;
    }

    if (msg.role === "user") {
      // Merge consecutive user messages
      const last = transformed[transformed.length - 1];
      if (last && last.role === "user" && typeof last.content === "string") {
        last.content = last.content + "\n" + msg.content;
        continue;
      }
      transformed.push({
        role: "user",
        content: msg.content,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const content: Array<Record<string, unknown>> = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const toolCall of msg.tool_calls || []) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: parseToolArguments(toolCall.function.arguments),
        });
      }
      if (content.length === 0) {
        content.push({ type: "text", text: "" });
      }
      // Merge consecutive assistant messages
      const last = transformed[transformed.length - 1];
      if (last && last.role === "assistant" && Array.isArray(last.content)) {
        (last.content as Array<Record<string, unknown>>).push(...content);
        continue;
      }
      transformed.push({
        role: "assistant",
        content,
      });
      continue;
    }

    if (msg.role === "tool") {
      // Merge consecutive tool messages into a single user message
      // with multiple tool_result content blocks
      const toolResultBlock = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id || "unknown_tool_call",
        content: msg.content,
      };

      const last = transformed[transformed.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        // Append tool_result to existing user message with content blocks
        (last.content as Array<Record<string, unknown>>).push(toolResultBlock);
        continue;
      }

      transformed.push({
        role: "user",
        content: [toolResultBlock],
      });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: transformed,
  };
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { _raw: raw };
  }
}

function normalizeAnthropicFinishReason(reason: unknown): string {
  if (typeof reason !== "string") return "stop";
  if (reason === "tool_use") return "tool_calls";
  return reason;
}
