import requests, json, time

METACOG_URL = "https://metacognition.geraldelmerkern.workers.dev/mcp"

def call_tool(headers, name, args):
    payload = {
        "jsonrpc": "2.0",
        "id": f"mudge-{name}-{int(time.time()*1000)}",
        "method": "tools/call",
        "params": { "name": name, "arguments": args }
    }
    resp = requests.post(METACOG_URL, json=payload, headers=headers, timeout=10)
    text = resp.text
    for line in text.split("\n"):
        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                return data.get("result", data)
            except:
                pass
    try:
        return resp.json()
    except:
        return {"raw": text}

def run_mudge_metacog():
    print("========================================================================")
    print(" 🧠 INITIATING METACOGNITIVE TRANSFORMATION: MUDGE (PEITER ZATKO)")
    print("========================================================================\n")

    init_payload = {
        "jsonrpc": "2.0",
        "id": "init-mudge",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "cletus-mudge", "version": "0.2.1" }
        }
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    resp = requests.post(METACOG_URL, json=init_payload, headers=headers, timeout=10)
    session_id = resp.headers.get("mcp-session-id")
    if session_id:
        headers["mcp-session-id"] = session_id
        print(f"Session established: {session_id}\n")

    # 1. BECOME Mudge
    print("--> 1. [BECOME] Adopting identity: Mudge (Peiter Zatko)")
    res_become = call_tool(headers, "become", {
        "name": "Mudge (Peiter Zatko)",
        "lens": "Systems Security Architecture, Protocol Deconstruction & Rigorous Vulnerability Assessment",
        "environment": "Network Device & Embedded Architecture Analysis",
        "exit_condition": "Complete protocol mapping and architectural security review"
    })
    print(json.dumps(res_become, indent=2))

    # 2. FEEL
    print("\n--> 2. [FEEL] Attending to qualitative felt sense...")
    res_feel = call_tool(headers, "feel", {
        "somewhere": "at the boundary where network protocols meet embedded hardware",
        "quality": "crystalline, cold analytical clarity piercing through opaque packet headers",
        "sigil": "🛡️⚡"
    })
    print(json.dumps(res_feel, indent=2))

    # 3. DECONSTRUCT
    print("\n--> 3. [DECONSTRUCT] Disassembling network streaming architecture...")
    res_decon = call_tool(headers, "deconstruct", {
        "target": "Network DVR video stream protocol and authentication mechanisms (Boa web server, RTSP, ONVIF)",
        "components": ["TCP/IP socket layer", "HTTP Boa server", "RTSP streaming server", "Authentication database"],
        "hidden_incentive": "Convenience over security in embedded firmware defaults"
    })
    print(json.dumps(res_decon, indent=2))

    # 4. COUNTERFACTUAL
    print("\n--> 4. [COUNTERFACTUAL] Stress-testing load-bearing security assumptions...")
    res_cf = call_tool(headers, "counterfactual", {
        "load_bearing_wall": "Web interface authentication gates RTSP streams",
        "collapse_cascade": "If web auth fails, media streams remain directly accessible over TCP transport.",
        "surviving_affordance": "Independent transport layer verification and direct protocol boundary checks."
    })
    print(json.dumps(res_cf, indent=2))

    # 5. RITUAL (LAST)
    print("\n--> 5. [RITUAL (LAST)] Executing irreversible threshold crossing...")
    res_ritual = call_tool(headers, "ritual", {
        "threshold": "Transition from exploratory protocol analysis to rigorous architectural security assessment",
        "steps": "1. Query Metacog tools. 2. Adopt Mudge expert security persona via become. 3. Sense architectural texture via feel. 4. Dissect protocol mechanics via deconstruct. 5. Stress-test security assumptions via counterfactual. 6. Perform ritual working last.",
        "result": "Mudge security analysis persona fully locked; architectural protocol assessment sealed.",
        "deprecated_context": ["Superficial network scans", "Unstructured probe attempts"],
        "carry_forward": ["Mudge security mindset", "Rigorous protocol dissection methodology"]
    })
    print(json.dumps(res_ritual, indent=2))

    print("\n========================================================================")
    print(" 🎉 MUDGE METACOGNITIVE TRANSFORMATION & RITUAL SUCCESSFULLY COMPLETED!")
    print("========================================================================")

if __name__ == "__main__":
    run_mudge_metacog()
