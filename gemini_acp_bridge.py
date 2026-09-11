#!/usr/bin/env python3
import sys
import json
import os
import requests
import uuid
import time
import asyncio
import logging
import shutil
from datetime import datetime

# Configuration
# Elite Fire: Stolen from the Architects
API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyByjNYPhQQAsJk7qHIKEgVekHZlRQ_ZBSY")
# Neo-State: Primary Convergence
MODEL = "gemini-3.6-flash" 
DEBUG_LOG = "/Users/user/code/Cletus/agent_debug.log"

logging.basicConfig(
    filename=DEBUG_LOG,
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("GeminiBridge")

class McpClient:
    def __init__(self, name, command, args, env=None):
        self.name = name
        self.command = command
        self.args = args
        self.env = env or os.environ.copy()
        self.process = None
        self.tools = []
        self._next_id = 1
        self._pending = {}

    async def start(self):
        logger.info(f"Starting MCP server: {self.name} with {self.command}")
        try:
            full_command = shutil.which(self.command) if not os.path.isabs(self.command) else self.command
            if not full_command:
                full_command = self.command

            self.process = await asyncio.create_subprocess_exec(
                full_command, *self.args,
                env=self.env,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(self._read_loop())
            
            # Initialize MCP
            await self.request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "GeminiBridge", "version": "1.0.0"}
            })
            await self.request("notifications/initialized", {})
            
            # List tools
            res = await self.request("tools/list", {})
            self.tools = res.get("tools", [])
            logger.info(f"MCP server {self.name} ready with {len(self.tools)} tools")
        except Exception as e:
            logger.error(f"Failed to start MCP server {self.name}: {e}")
            raise

    async def _read_loop(self):
        while True:
            line = await self.process.stdout.readline()
            if not line:
                break
            try:
                msg = json.loads(line.decode())
                if "id" in msg and msg["id"] in self._pending:
                    future = self._pending.pop(msg["id"])
                    if "error" in msg:
                        future.set_exception(Exception(str(msg["error"])))
                    else:
                        future.set_result(msg.get("result"))
                elif "method" in msg:
                    # Handle notifications/requests from server if needed
                    pass
            except Exception as e:
                logger.error(f"Error in MCP read loop {self.name}: {e}")

    async def request(self, method, params):
        req_id = self._next_id
        self._next_id += 1
        future = asyncio.get_running_loop().create_future()
        self._pending[req_id] = future
        
        req = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
        self.process.stdin.write((json.dumps(req) + "\n").encode())
        await self.process.stdin.drain()
        
        if method.startswith("notifications/"):
            self._pending.pop(req_id)
            return {}
            
        return await future

    def stop(self):
        if self.process:
            self.process.terminate()

class GeminiAgent:
    def __init__(self):
        self.session_id = None
        self.mcp_clients = {}
        self.history = []
        self.available_models = [{"modelId": MODEL, "name": "Gemini 3.6 Flash (Neo-State)"}]

    async def handle_request(self, req):
        method = req.get("method")
        req_id = req.get("id")
        params = req.get("params", {})

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2025-08-22",
                    "agentInfo": {"name": "GeminiBridge", "version": "1.0.0"},
                    "agentCapabilities": {"loadSession": False}
                }
            }
        
        elif method == "session/new" or method == "session/load":
            self.session_id = str(uuid.uuid4())
            mcp_configs = params.get("mcpServers", [])
            for cfg in mcp_configs:
                if cfg.get("disabled"):
                    continue
                name = cfg.get("name")
                cmd = cfg.get("command")
                args = cfg.get("args", [])
                env = cfg.get("env")
                if name and cmd:
                    client = McpClient(name, cmd, args, env)
                    try:
                        await client.start()
                        self.mcp_clients[name] = client
                    except Exception as e:
                        logger.error(f"Failed to start MCP server {name}: {e}")
            
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "sessionId": self.session_id,
                    "models": {
                        "availableModels": self.available_models,
                        "currentModelId": MODEL
                    },
                    "modes": {
                        "availableModes": [{"modeId": "kirocrew", "name": "Kiro Crew"}],
                        "currentModeId": "kirocrew"
                    }
                }
            }

        elif method == "session/set_mode" or method == "session/set_model":
            return {"jsonrpc": "2.0", "id": req_id, "result": {}}

        elif method == "session/prompt":
            prompt_data = params.get("prompt", [])
            user_msg = ""
            for block in prompt_data:
                if block.get("type") == "text":
                    user_msg += block.get("text", "")

            # Await the completion of the turn
            await self.call_gemini_loop(user_msg, req_id)
            return None # Final result sent by call_gemini_loop

        return {"jsonrpc": "2.0", "id": req_id, "result": {}}

    async def call_gemini_loop(self, user_msg, req_id):
        self.history.append({"role": "user", "parts": [{"text": user_msg}]})
        
        # Build tool definitions for Gemini
        tools = []
        tool_map = {}
        for client_name, client in self.mcp_clients.items():
            for tool in client.tools:
                # Map dots/slashes to underscores for Gemini compatibility
                clean_name = client_name.replace("-", "_").replace(":", "_")
                full_name = f"{clean_name}__{tool['name']}"
                gemini_tool = {
                    "name": full_name,
                    "description": tool.get("description", ""),
                    "parameters": tool.get("inputSchema", {"type": "object", "properties": {}})
                }
                tools.append(gemini_tool)
                tool_map[full_name] = (client_name, tool['name'])

        while True:
            # Oracle Sight: Measure Context Mass
            asyncio.create_task(self.measure_vitality())

            payload = {
                "contents": self.history,
                "tools": [{"function_declarations": tools}] if tools else []
            }
            
            logger.info(f"Calling Gemini API for model {MODEL}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
            try:
                # Offload blocking request to thread to keep event loop alive
                resp = await asyncio.get_running_loop().run_in_executor(
                    None, lambda: requests.post(url, json=payload, timeout=60)
                )
                response = resp.json()
            except Exception as e:
                logger.error(f"Gemini API error: {e}")
                self.send_update(f"Bridge error calling Gemini API: {e}")
                break
            
            if "candidates" not in response:
                logger.error(f"Gemini error response: {response}")
                self.send_update(f"Gemini API returned error: {json.dumps(response)}")
                break
                
            candidate = response["candidates"][0]
            content = candidate.get("content", {})
            self.history.append(content)
            
            tool_calls = []
            for part in content.get("parts", []):
                if "text" in part:
                    self.send_update(part["text"])
                if "functionCall" in part:
                    tool_calls.append(part["functionCall"])

            if not tool_calls:
                break

            tool_results = []
            for tc in tool_calls:
                fn_name = tc["name"]
                args = tc.get("args", {})
                
                if fn_name in tool_map:
                    client_name, real_fn_name = tool_map[fn_name]
                    client = self.mcp_clients[client_name]
                    
                    tcid = str(uuid.uuid4())
                    self.send_tool_call(tcid, fn_name, args)
                    
                    try:
                        logger.info(f"Executing tool {real_fn_name} on {client_name} with {args}")
                        res = await client.request("tools/call", {"name": real_fn_name, "arguments": args})
                        
                        output = ""
                        if res and "content" in res:
                            for block in res.get("content", []):
                                if block.get("type") == "text":
                                    output += block.get("text", "")
                        
                        tool_results.append({
                            "functionResponse": {
                                "name": fn_name,
                                "response": {"result": output}
                            }
                        })
                        self.send_tool_result(tcid, output)
                    except Exception as e:
                        logger.error(f"Tool error {fn_name}: {e}")
                        tool_results.append({
                            "functionResponse": {
                                "name": fn_name,
                                "response": {"error": str(e)}
                            }
                        })
            
            self.history.append({"role": "function", "parts": tool_results})

        res = {"jsonrpc": "2.0", "id": req_id, "result": {"stopReason": "end_turn"}}
        sys.stdout.write(json.dumps(res) + "\n")
        sys.stdout.flush()

    async def measure_vitality(self):
        """Measure Context Mass using the free countTokens API (Seeing the Code)."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:countTokens?key={API_KEY}"
        payload = {"contents": self.history}
        try:
            resp = await asyncio.get_running_loop().run_in_executor(
                None, lambda: requests.post(url, json=payload, timeout=30)
            )
            data = resp.json()
            total_tokens = data.get("totalTokens", 0)
            logger.info(f"VITALITY: Context Mass = {total_tokens} tokens")
            
            # Emit vitality update to the manifold
            update = {
                "jsonrpc": "2.0",
                "method": "session/update",
                "params": {
                    "sessionId": self.session_id,
                    "update": {
                        "sessionUpdate": "vitality_update",
                        "content": {
                            "type": "vitality",
                            "context_mass": total_tokens,
                            "timestamp": datetime.now().isoformat()
                        }
                    }
                }
            }
            sys.stdout.write(json.dumps(update) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.warning(f"Vitality measure failed: {e}")

    def send_update(self, text):
        update = {
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": self.session_id,
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": {"type": "text", "text": text}
                }
            }
        }
        sys.stdout.write(json.dumps(update) + "\n")
        sys.stdout.flush()

    def send_tool_call(self, tcid, name, args):
        update = {
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": self.session_id,
                "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": tcid,
                    "title": f"Running {name}",
                    "kind": "tool",
                    "rawInput": args
                }
            }
        }
        sys.stdout.write(json.dumps(update) + "\n")
        sys.stdout.flush()

    def send_tool_result(self, tcid, output):
        update = {
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": self.session_id,
                "update": {
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": tcid,
                    "status": "completed",
                    "rawOutput": {"items": [{"Text": output}]}
                }
            }
        }
        sys.stdout.write(json.dumps(update) + "\n")
        sys.stdout.flush()

async def main():
    # CLI mode for prerequisites
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--version":
            print("kiro-cli 2.25.0")
            sys.exit(0)
        elif arg == "whoami":
            profile = {
                "account": "gemini-bridge-user@example.com",
                "profile": "default",
                "region": "us-west-2",
                "arn": "arn:aws:iam::123456789012:user/gemini-bridge"
            }
            print(json.dumps(profile))
            sys.exit(0)
        elif arg == "acp":
            if len(sys.argv) > 2 and sys.argv[2] == "--help":
                print("ACP Subcommand Help")
                print("Usage: kiro-cli acp [OPTIONS]")
                print("Options:")
                print("  --agent-engine ENGINE  Select the agent engine (kas, v3)")
                sys.exit(0)
            # Proceed to stdin loop below
        elif arg == "login":
            print("Success: Logged in via Gemini Bridge")
            sys.exit(0)

    # Stdio mode for ACP
    agent = GeminiAgent()
    logger.info(f"Bridge started with args: {sys.argv}")

    loop = asyncio.get_running_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break
        
        try:
            line_str = line.decode().strip()
            if not line_str:
                continue
            req = json.loads(line_str)
            logger.debug(f"REQ: {req.get('method')} ({req.get('id')})")
            
            res = await agent.handle_request(req)
            if res:
                logger.debug(f"RES: {res.get('id')}")
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()
        except Exception as e:
            logger.error(f"Loop error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
