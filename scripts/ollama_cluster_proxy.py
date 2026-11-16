/**
 * Local Ollama Cluster Proxy Daemon
 *
 * Exposes a local OpenAI/Ollama compatible endpoint (port 11435 or 11434)
 * that transparently proxies model listings and inference calls to our
 * verified remote cluster nodes without using local storage.
 */

import http from "http";
import https from "https";
import { URL } from "url";

const CLUSTER_NODES: Record<string, string> = {
  "deepseek-r1:671b": "http://45.32.114.54:11434",
  "llama3.3:70b": "http://45.32.114.54:11434",
  "qwen3-coder:30b": "http://172.104.114.91:11434",
  "llama3.1:8b": "http://172.104.114.91:11434",
  "bge-m3": "http://172.104.114.91:11434",
  "qwen2.5-coder:14b": "http://165.227.33.170:11434",
  "deepseek-r1:1.5b": "http://165.227.33.170:11434",
};

const DEFAULT_NODE = "http://45.32.114.54:11434";
const PORT = process.env.OLLAMA_PROXY_PORT ? parseInt(process.env.OLLAMA_PROXY_PORT) : 11435;

const server = http.createServer((req, res) => {
  const reqUrl = req.url || "/";

  // Handle /api/tags or /v1/models listing
  if (reqUrl.includes("/api/tags") || reqUrl.includes("/v1/models")) {
    const modelsList = Object.keys(CLUSTER_NODES).map((model) => ({
      name: model,
      model: model,
      modified_at: new Date().toISOString(),
      size: 0,
      details: { format: "gguf", family: "cluster" },
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: modelsList, data: modelsList }));
    return;
  }

  let bodyChunks: Buffer[] = [];
  req.on("data", (chunk) => bodyChunks.push(chunk));
  req.on("end", () => {
    const bodyStr = Buffer.concat(bodyChunks).toString();
    let targetNode = DEFAULT_NODE;
    let payloadObj: any = {};

    try {
      payloadObj = JSON.parse(bodyStr);
      if (payloadObj.model && CLUSTER_NODES[payloadObj.model]) {
        targetNode = CLUSTER_NODES[payloadObj.model];
      }
    } catch {}

    // Map /v1/chat/completions to /api/chat natively
    let destPath = "/api/chat";
    if (payloadObj.stream === undefined) {
      payloadObj.stream = false;
    }

    const cleanBase = targetNode.replace(/\/v1\/?$/, "").replace(/\/$/, "");
    const targetUrlStr = `${cleanBase}${destPath}`;
    const targetUrl = new URL(targetUrlStr);
    const client = targetUrl.protocol === "https:" ? https : http;

    const modifiedBody = JSON.stringify(payloadObj);

    const proxyReq = client.request(
      targetUrlStr,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(modifiedBody),
        },
      },
      (proxyRes) => {
        let respChunks: Buffer[] = [];
        proxyRes.on("data", (c) => respChunks.push(c));
        proxyRes.on("end", () => {
          const respText = Buffer.concat(respChunks).toString();
          try {
            const rawJson = JSON.parse(respText);
            // Transform Ollama native response to OpenAI format if requested via /v1
            if (reqUrl.includes("/v1/") && rawJson.message) {
              const openAiResp = {
                id: `chatcmpl-proxy-${Date.now()}`,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: rawJson.model || payloadObj.model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: rawJson.message.role || "assistant",
                      content: rawJson.message.content || "",
                    },
                    finish_reason: "stop",
                  },
                ],
              };
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(openAiResp));
              return;
            }
          } catch {}

          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(respText);
        });
      },
    );

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }));
    });

    proxyReq.write(modifiedBody);
    proxyReq.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[OLLAMA PROXY] Cluster proxy listening locally on port ${PORT}`);
});
