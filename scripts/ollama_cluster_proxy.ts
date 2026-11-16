/**
 * Local Ollama Cluster Proxy Daemon
 *
 * Exposes a local OpenAI/Ollama compatible endpoint (port 11439)
 * that transparently proxies model listings and inference calls to our
 * verified remote cluster nodes without using local storage.
 */

import http from "http";
import https from "https";
import { URL } from "url";
import fs from "fs";

// Load 151 cluster models mapping
let CLUSTER_NODES: Record<string, string> = {
  "deepseek-r1:671b": "http://45.32.114.54:11434",
  "llama3.3:70b": "http://45.32.114.54:11434",
  "qwen3-coder:30b": "http://172.104.114.91:11434",
  "llama3.1:8b": "http://172.104.114.91:11434",
  "bge-m3": "http://172.104.114.91:11434",
  "qwen2.5-coder:14b": "http://165.227.33.170:11434",
  "deepseek-r1:1.5b": "http://165.227.33.170:11434",
};

try {
  const jsonPath = "/Users/user/code/Cletus/scripts/cluster_nodes.json";
  if (fs.existsSync(jsonPath)) {
    CLUSTER_NODES = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }
} catch {}

const DEFAULT_NODE = "http://45.32.114.54:11434";
const PORT = process.env.OLLAMA_PROXY_PORT ? parseInt(process.env.OLLAMA_PROXY_PORT) : 11439;

const server = http.createServer((req, res) => {
  const reqUrl = req.url || "/";

  // Handle /api/tags or /v1/models listing for GET requests
  if (req.method === "GET" && (reqUrl.includes("tags") || reqUrl.includes("models"))) {
    const modelsList = Object.keys(CLUSTER_NODES).map((model) => ({
      name: model,
      model: model,
      modified_at: new Date().toISOString(),
      size: 0,
      details: { format: "gguf", family: "cluster" },
    }));

    const jsonStr = JSON.stringify({ models: modelsList, data: modelsList });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(jsonStr),
    });
    res.end(jsonStr);
    return;
  }

  // Handle POST chat/completions or generate proxying
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

    const cleanBase = targetNode.replace(/\/v1\/?$/, "").replace(/\/$/, "");
    const destPath = "/api/chat";
    if (payloadObj.stream === undefined) {
      payloadObj.stream = false;
    }

    const targetUrlStr = `${cleanBase}${destPath}`;
    const client = targetUrlStr.startsWith("https:") ? https : http;

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
              const responseString = JSON.stringify(openAiResp);
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(responseString),
              });
              res.end(responseString);
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

    if (bodyStr) {
      proxyReq.write(modifiedBody);
    }
    proxyReq.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[OLLAMA PROXY] Cluster proxy listening locally on port ${PORT}`);
});
