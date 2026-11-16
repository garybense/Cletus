#!/usr/bin/env python3
"""
Extract unique models from the honeypot-filtered scan results.
Returns a clean list of model entries to be added to Cletus's model registry.
"""
import re
import json
import sys

def extract_verified_models(scan_file: str) -> list[str]:
    """Extract unique model names from verified IPs section of scan results."""
    with open(scan_file, 'r') as f:
        content = f.read()

    # Split at the "VERIFIED IPs WITH MODELS" header
    parts = content.split('VERIFIED IPs WITH MODELS')
    if len(parts) < 2:
        return []

    # Find the end of verified section (before next section or EOF)
    verified_section = parts[1]
    # Cut at any section header in all caps that looks like a new section
    section_end = re.search(r'\n[A-Z][A-Z ]{20,}\n', verified_section)
    if section_end:
        verified_section = verified_section[:section_end.start()]

    models = set()
    # Match "- model_name" patterns
    for match in re.finditer(r'^      - (.+)$', verified_section, re.MULTILINE):
        model = match.group(1).strip()
        models.add(model)

    return sorted(models)

def categorize_model(model: str) -> dict:
    """Categorize a model for registry entry."""
    model_lower = model.lower()

    # Determine provider
    if 'cloud' in model_lower:
        provider = 'ollama'
    elif model_lower.startswith('openai/') or model_lower.startswith('meta/'):
        provider = 'ollama'
    elif 'hf.co/' in model_lower:
        provider = 'ollama'
    else:
        provider = 'ollama'

    # Determine if it supports tools (most do)
    supports_tools = ':embed' not in model_lower and 'nomic' not in model_lower

    # Determine if it supports vision
    supports_vision = 'vision' in model_lower or model_lower.startswith('llava')

    # Estimate max tokens based on model size indicators
    max_tokens = 4096
    context_window = 128000

    if '671b' in model_lower:
        max_tokens = 8192
        context_window = 131072
    elif '120b' in model_lower:
        max_tokens = 8192
    elif '70b' in model_lower or '72b' in model_lower:
        max_tokens = 8192
    elif '32b' in model_lower:
        max_tokens = 4096

    return {
        "modelId": model,
        "provider": provider,
        "displayName": model,
        "tierMinimum": "normal",
        "costPer1kInput": 0,  # Ollama = free
        "costPer1kOutput": 0,
        "maxTokens": max_tokens,
        "contextWindow": context_window,
        "supportsTools": supports_tools,
        "supportsVision": supports_vision,
        "parameterStyle": "max_tokens",
        "enabled": True,
    }

if __name__ == '__main__':
    scan_file = '/Users/user/code/Aethel/scrap/scan_with_honeypot_detection.txt'
    models = extract_verified_models(scan_file)

    # Filter out honeypot probe artifacts and junk models
    filtered = []
    skip_keywords = [
        'trigger', 'sysverify', 'sys_aux', 'sysdiag', 'ops-verify', 'vuln_test',
        'fuzz', 'cve-', 'exfil', 'hc-', 'leak/', 'probe', 'test/', 'zz_',
        'nonexistent', 'real-gguf-test', 'passion-med-pan-skiing'
    ]

    for m in models:
        if any(kw in m.lower() for kw in skip_keywords):
            continue
        if m.startswith('129.153.133.23/l/') or m.startswith('129.153.133.23/leak/'):
            continue
        filtered.append(m)

    print(json.dumps(filtered, indent=2))
    print(f"\n# Total unique verified models: {len(filtered)}", file=sys.stderr)
