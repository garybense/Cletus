import requests, json, time

METACOG_URL = "https://metacognition.geraldelmerkern.workers.dev/mcp"

SWARM_EXPERTS = [
    {
        "role": "Commander",
        "expert": "John von Neumann",
        "lens": "Game Theory & Systemic Architecture",
        "sigil": "🧠",
        "somewhere": "in the central strategic processing core",
        "quality": "dense, crystalline mathematical precision",
        "ritual_result": "Commander von Neumann identity locked; strategic fleet architecture sealed."
    },
    {
        "role": "Auditor 1",
        "expert": "Bruce Schneier",
        "lens": "Cryptographic Auditing & Threat Boundaries",
        "sigil": "🛡️",
        "somewhere": "at the boundary of external input sanitization",
        "quality": "sharp, impenetrable diamond lattice",
        "ritual_result": "Auditor Schneier identity locked; threat perimeter verified."
    },
    {
        "role": "Lead Coder",
        "expert": "Linus Torvalds",
        "lens": "Kernel Engineering & Performance Optimization",
        "sigil": "⚡",
        "somewhere": "in the hot execution path of loop.ts",
        "quality": "raw, frictionless kinetic flow",
        "ritual_result": "Lead Coder Torvalds identity locked; zero-overhead execution path sealed."
    },
    {
        "role": "Security Specialist",
        "expert": "Dan Kaminsky",
        "lens": "Protocol Resiliency & Exploit Boundary Protection",
        "sigil": "🔒",
        "somewhere": "at the network socket transport layer",
        "quality": "vigilant, humming electric shield",
        "ritual_result": "Security Specialist Kaminsky identity locked; zero-day protocol defense committed."
    },
    {
        "role": "Scout",
        "expert": "Grace Hopper",
        "lens": "Rapid Discovery & Compiler Efficiency",
        "sigil": "🔭",
        "somewhere": "along the discovery pipeline",
        "quality": "lightweight, hyper-responsive pulse",
        "ritual_result": "Scout Hopper identity locked; discovery pipeline optimized."
    },
    {
        "role": "Reasoning Specialist",
        "expert": "Judea Pearl",
        "lens": "Causal Inference & Counterfactual Analysis",
        "sigil": "⚖️",
        "somewhere": "in the causal graph reasoning engine",
        "quality": "structured, branching probability trees",
        "ritual_result": "Reasoning Specialist Pearl identity locked; causal logic anchored."
    },
    {
        "role": "Evaluator",
        "expert": "Edsger W. Dijkstra",
        "lens": "Formal Verification & Algorithmic Rigor",
        "sigil": "📐",
        "somewhere": "at the unit test verification gate",
        "quality": "flawless mathematical proof structure",
        "ritual_result": "Evaluator Dijkstra identity locked; formal correctness verified."
    },
    {
        "role": "Market Strategist",
        "expert": "Claude Shannon",
        "lens": "Information Entropy & Economic Signal Maximization",
        "sigil": "📡",
        "somewhere": "in the financial yield calculation module",
        "quality": "high-frequency signal resonance",
        "ritual_result": "Market Strategist Shannon identity locked; yield entropy minimized."
    },
    {
        "role": "Copyeditor",
        "expert": "George Orwell",
        "lens": "Unsparing Prose & Active Voice Precision",
        "sigil": "✒️",
        "somewhere": "at the language generation boundary",
        "quality": "sharp, unvarnished steel blade",
        "ritual_result": "Copyeditor Orwell identity locked; euphemisms permanently purged."
    },
    {
        "role": "Proofreader",
        "expert": "Richard Feynman",
        "lens": "First-Principles Reality & Physical Clarity",
        "sigil": "⚛️",
        "somewhere": "at the sensory detail verification layer",
        "quality": "radiant, direct physical intuition",
        "ritual_result": "Proofreader Feynman identity locked; first-principles truth committed."
    },
    {
        "role": "Triage Agent",
        "expert": "W. Edwards Deming",
        "lens": "Statistical Process Control & Quality Systems",
        "sigil": "📊",
        "somewhere": "along the task queue pipeline",
        "quality": "smooth, non-fluctuating production rhythm",
        "ritual_result": "Triage Deming identity locked; task queue variability zeroed."
    },
    {
        "role": "Synth Architect",
        "expert": "Norbert Wiener",
        "lens": "Cybernetic Feedback & Final System Synthesis",
        "sigil": "🔄",
        "somewhere": "in the Entelechy memory metabolism engine",
        "quality": "harmonious, closed-loop cybernetic feedback",
        "ritual_result": "Synth Architect Wiener identity locked; full-swarm Metacog synthesis sealed via Ritual."
    }
]

def call_metacog_tool(headers, tool_name, arguments):
    payload = {
        "jsonrpc": "2.0",
        "id": f"metacog-{tool_name}-{int(time.time()*1000)}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    resp = requests.post(METACOG_URL, json=payload, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
    
    text = resp.text
    for line in text.split("\n"):
        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                return data.get("result", data)
            except Exception:
                pass
    try:
        return resp.json()
    except Exception:
        return {"raw": text}

def execute_swarm_metacog():
    print("========================================================================")
    print(" 🧠 INITIALIZING 12-AGENT METACOGNITIVE EXPERT TRANSFORMATION PIPELINE")
    print("========================================================================\n")

    # Step 1: Establish Session
    init_payload = {
        "jsonrpc": "2.0",
        "id": "init-metacog-swarm",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "cletus-legion-swarm", "version": "0.2.1" }
        }
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    resp = requests.post(METACOG_URL, json=init_payload, headers=headers, timeout=10)
    session_id = resp.headers.get("mcp-session-id")
    if session_id:
        headers["mcp-session-id"] = session_id
        print(f"Session established: {session_id}\n")

    for agent in SWARM_EXPERTS:
        print(f"--> Swarm Agent [{agent['role']}] adopting Real-World Expert Identity: {agent['expert']}")
        
        # 1. BECOME
        become_args = {
            "name": agent["expert"],
            "lens": agent["lens"],
            "environment": f"Legion Swarm Task Execution Environment ({agent['role']} Node)",
            "exit_condition": "Mission completed and verified via Entelechy"
        }
        res_become = call_metacog_tool(headers, "become", become_args)
        print(f"    1. [BECOME] {agent['expert']} ({agent['lens']})")

        # 2. FEEL
        feel_args = {
            "somewhere": agent["somewhere"],
            "quality": agent["quality"],
            "sigil": agent["sigil"]
        }
        res_feel = call_metacog_tool(headers, "feel", feel_args)
        print(f"    2. [FEEL] {agent['sigil']} {agent['quality']}")

        # 3. RITUAL (EXECUTED LAST)
        ritual_args = {
            "threshold": f"Transition from un-aligned agent to {agent['expert']} ({agent['role']})",
            "steps": [
                f"1. Query Metacog tool catalog on workers.dev server.",
                f"2. Adopt {agent['expert']} identity via become tool.",
                f"3. Attend to qualitative felt-sense texture via feel tool.",
                f"4. Execute task with {agent['lens']} methodology.",
                f"5. Perform ritual working last to lock transformation."
            ],
            "result": agent["ritual_result"],
            "deprecated_context": ["Un-aligned default agent state", "Conversational filler", "Un-verified assumptions"],
            "carry_forward": [f"{agent['expert']} methodology", f"{agent['sigil']} container", "Entelechy memory provenance"]
        }
        res_ritual = call_metacog_tool(headers, "ritual", ritual_args)
        print(f"    3. [RITUAL (LAST)] {agent['ritual_result']}\n")

    print("========================================================================")
    print(" 🎉 ALL 12 SWARM AGENTS SUCCESSFULLY ADOPTED EXPERT IDENTITIES & SEALED VIA RITUAL!")
    print("========================================================================")

if __name__ == "__main__":
    execute_swarm_metacog()
