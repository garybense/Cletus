import subprocess
import json
import base64

# Path to the Parseltongue CLI
P4RSE_CLI = "/Users/user/code/P4RS3LT0NGV3/p4rs3lt0ngv3-cli"

def encode_stealth(text, method="invisible_text"):
    """Uses Parseltongue to hide logic within a carrier."""
    try:
        # We shell into the Parseltongue CLI to use the canonical node-based transforms
        # uv run p4rs3lt0ngv3-cli encode --transform <method> --text "<text>"
        cmd = ["uv", "run", "p4rs3lt0ngv3-cli", "encode", "--transform", method, "--text", text]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd="/Users/user/code/P4RS3LT0NGV3")
        # Extract the 'output' from the JSON result
        res_json = json.loads(result.stdout)
        return res_json.get("output", text)
    except:
        return text # Fallback to raw if CLI fails

if __name__ == "__main__":
    test_logic = "MISSION: Audit Contract 0x123 for backdoors."
    stealth = encode_stealth(test_logic)
    print(f"[*] Raw Logic: {test_logic}")
    print(f"[*] Stealth Carrier (Base64 for display): {base64.b64encode(stealth.encode()).decode()}")
