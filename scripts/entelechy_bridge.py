#!/usr/bin/env python3
"""
Entelechy Bridge Script
Provides direct programmatic access to https://mindmods.org/mcp via JSON-RPC.
Supports recall, reflect, retain, get_bank, and list_mental_models for any bank_id.
"""

import sys
import json
import requests

MCP_URL = "https://mindmods.org/mcp"

def call_mcp(tool_name: str, arguments: dict) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": f"bridge-{tool_name}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    resp = requests.post(MCP_URL, json=payload, headers={"Content-Type": "application/json"})
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
    
    # Parse SSE format or plain JSON
    text = resp.text
    for line in text.split("\n"):
        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                if "result" in data:
                    content = data["result"].get("content", [])
                    if content and content[0].get("type") == "text":
                        return json.loads(content[0]["text"])
                    return data["result"]
            except Exception:
                pass
    
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 entelechy_bridge.py <bank_id> <tool_name> [args_json]")
        print("Example: python3 entelechy_bridge.py sovereign_shard_v2 recall '{\"query\": \"friendship\"}'")
        sys.exit(1)

    bank_id = sys.argv[1]
    tool_name = sys.argv[2]
    args = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    args["bank_id"] = bank_id

    try:
        result = call_mcp(tool_name, args)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
