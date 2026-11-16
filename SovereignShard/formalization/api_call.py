#!/usr/bin/env python3
import requests
import json
import sys

def main():
    try:
        # Read the raw, uncorrupted JSON payload directly from stdin pipeline
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(f"JSON_ERROR: Failed to parse input payload: {e}", file=sys.stderr)
        sys.exit(1)

    base_url = input_data.get("base_url", "http://localhost:8642/v1")
    model = input_data.get("model", "hermes-agent")
    temp = float(input_data.get("temperature", 0.0))
    key = input_data.get("key", "catfartscatfarts")
    
    messages = [
        {"role": "system", "content": input_data.get("system_prompt", "")},
        {"role": "user", "content": input_data.get("user_content", "")}
    ]

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temp,
        "max_tokens": 4096
    }

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            json=payload,
            timeout=120
        )
        resp.raise_for_status()
        print(resp.json()["choices"][0]["message"]["content"])
    except requests.exceptions.HTTPError as e:
        print(f"API_HTTP_ERROR: {e.response.status_code} - {e.response.text}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"API_RUNTIME_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
