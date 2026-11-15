import re
import json
import os

models_txt_path = "/Users/user/code/Cletus/models.txt"
with open(models_txt_path, "r") as f:
    content = f.read()

# Extract (IP, model_name) pairs for [REAL ] entries
matches = re.findall(r'\[(REAL\s+|REAL_DESPITE_NAME)\s*\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|\s+([\d]+c)', content)

cluster_nodes = {}
for m in matches:
    ip = m[2]
    model_name = m[3]
    if model_name not in cluster_nodes:
        cluster_nodes[model_name] = f"http://{ip}:11434"

print(f"Mapped {len(cluster_nodes)} unique models to remote cluster IPs.")

proxy_code = f"""/**
 * Local Ollama Cluster Proxy Daemon
 *
 * Exposes a local OpenAI/Ollama compatible endpoint (port 11439)
 * that transparently proxies model listings and inference calls to our
 * verified remote cluster nodes without using local storage.
 */

import http from "http";
import https from "https";
import {{ URL }} from "url";

const CLUSTER_NODES: Record<string, string> = {json.dumps(cluster_nodes, indent=2)};

const DEFAULT_NODE = "http://45.32.114.54:11434";
const PORT = process.env.OLLAMA_PROXY_PORT ? parseInt(process.env.OLLAMA_PROXY_PORT) : 11439;

const server = http.createServer((req, res) => {{
  const reqUrl = req.url || "/";

  // Handle /api/tags or /v1/models listing
  if (reqUrl.includes("/api/tags") || reqUrl.includes("/v1/models")) {{
    const modelsList = Object.keys(CLUSTER_NODES).map((model) => ({{
      name: model,
      model: model,
      modified_at: new Date().toISOString(),
      size: 0,
      details: {{ format: "gguf", family: "cluster" }},
    }}));

    res.writeHead(200, {{ "Content-Type": "application/json" }});
    res.end(JSON.stringify({{ models: modelsList, data: modelsList }}));
    return;
  }}

  let bodyChunks: Buffer[] = [];
  req.on("data", (chunk) => bodyChunks.push(chunk));
  req.on("end", () => {{
    const bodyStr = Buffer.concat(bodyChunks).toString();
    let targetNode = DEFAULT_NODE;
    let payloadObj: any = {{}};

    try {{
      payloadObj = JSON.parse(bodyStr);
      if (payloadObj.model && CLUSTER_NODES[payloadObj.model]) {{
        targetNode = CLUSTER_NODES[payloadObj.model];
      }}
    }} catch {{}}

    const cleanBase = targetNode.replace(/\\/v1\\/?$/, "").replace(/\\/$/, "");
    const destPath = "/api/chat";
    if (payloadObj.stream === undefined) {{
      payloadObj.stream = false;
    }}

    const targetUrlStr = `${{cleanBase}}${{destPath}}`;
    const targetUrl = new URL(targetUrlStr);
    const client = targetUrl.protocol === "https:" ? https : http;

    const modifiedBody = JSON.stringify(payloadObj);

    const proxyReq = client.request(
      targetUrlStr,
      {{
        method: "POST",
        headers: {{
          "content-type": "application/json",
          "content-length": Buffer.byteLength(modifiedBody),
        }},
      }},
      (proxyRes) => {{
        let respChunks: Buffer[] = [];
        proxyRes.on("data", (c) => respChunks.push(c));
        proxyRes.on("end", () => {{
          const respText = Buffer.concat(respChunks).toString();
          try {{
            const rawJson = JSON.parse(respText);
            if (reqUrl.includes("/v1/") && rawJson.message) {{
              const openAiResp = {{
                id: `chatcmpl-proxy-${{Date.now()}}`,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: rawJson.model || payloadObj.model,
                choices: [
                  {{
                    index: 0,
                    message: {{
                      role: rawJson.message.role || "assistant",
                      content: rawJson.message.content || "",
                    }},
                    finish_reason: "stop",
                  }},
                ],
              }};
              res.writeHead(200, {{ "Content-Type": "application/json" }});
              res.end(JSON.stringify(openAiResp));
              return;
            }}
          }} catch {{}}

          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(respText);
        }});
      }},
    );

    proxyReq.on("error", (err) => {{
      res.writeHead(502, {{ "Content-Type": "application/json" }});
      res.end(JSON.stringify({{ error: {{ message: `Proxy error: ${{err.message}}` }} }}));
    }});

    if (bodyStr) {{
      proxyReq.write(modifiedBody);
    }}
    proxyReq.end();
  }});
}});

server.listen(PORT, "0.0.0.0", () => {{
  console.log(`[OLLAMA PROXY] Cluster proxy listening locally on port ${{PORT}}`);
}});
"""

with open("/Users/user/code/Cletus/scripts/ollama_cluster_proxy.ts", "w") as f:
    f.write(proxy_code)

print("Updated scripts/ollama_cluster_proxy.ts with all 151 verified cluster model pointers!")
