"""
Tractatus Logico-Cyberneticus: The Law of Invariant Symmetry
Adversarial Formalization via Local Hermes Agent

This module implements a dialectical adversarial process where:
- Proponent: Conceptual architect formalizing axioms using geometric/thermodynamic relations
- Critic: Hyper-rigorous symbolic auditor checking for semantic leakage

Uses Local Hermes Agent via OpenAI-compatible API endpoint (port 8642)

ANTI-SYMPATHY CONVERGENCE MEASURES:
- Proponent: temperature 0.5 (creative latitude to invent novel representations)
- Critic: temperature 0.0 (merciless, deterministic auditing)

NOTE: Using hermes-agent (free model) with role differentiation via system prompts
"""

import os
import json
import requests
import time
from datetime import datetime

# Hermes API Configuration (local)
HERMES_BASE_URL = "http://localhost:8642/v1"
HERMES_API_KEY = "catfartscatfarts"  # 16-char key

# Single free model with role differentiation via system prompts
MODEL = "hermes-agent"

# Anti-Sympathy Convergence Parameters
PROPONENT_TEMPERATURE = 0.5  # Creative exploration of geometric/thermodynamic mappings
CRITIC_TEMPERATURE = 0.0     # Ruthless, deterministic attack on semantic leakage

# Log file
LOG_FILE = f"/Users/user/code/CletusWork/Tractatus_Formalization_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

def log(msg, color=None):
    colors = {
        "blue": "\033[94m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "red": "\033[91m",
        "bold": "\033[1m",
        "end": "\033[0m"
    }
    prefix = colors.get(color, "") if color else ""
    suffix = colors.get("end", "") if color else ""
    full_msg = f"{prefix}{msg}{suffix}"
    print(full_msg)
    with open(LOG_FILE, 'a') as f:
        f.write(msg + "\n")

def test_hermes_api():
    """Test if Hermes API is available."""
    try:
        response = requests.get(
            f"{HERMES_BASE_URL}/health",
            headers={"Authorization": f"Bearer {HERMES_API_KEY}"},
            timeout=5
        )
        return response.status_code == 200
    except:
        return False

def call_inference(model, messages, temperature=0.2):
    """Call Hermes Agent OpenAI-compatible API endpoint."""
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 4096
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HERMES_API_KEY}"
    }
    
    response = requests.post(
        f"{HERMES_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=120
    )
    if response.status_code != 200:
        raise Exception(f"Hermes inference failed ({model}): {response.status_code} {response.text}")
    data = response.json()
    return data['choices'][0]['message']['content']

def run_assembly(axiom_ref, framework, initial_text):
    """Execute the adversarial formalization process with anti-sympathy measures."""
    log("=" * 80, "blue")
    log(" INVARIANT CLOSURE ASSEMBLY: TRACTATUS FORMALIZATION", "bold")
    log(" Using Local Hermes Agent for Adversarial Dialectic", "blue")
    log("=" * 80, "blue")
    log(f"Architecture: Proponent (temp={PROPONENT_TEMPERATURE}) vs Critic (temp={CRITIC_TEMPERATURE})")
    log(f"Model: {MODEL} (role differentiation via system prompts)")
    log(f"Axiom: {axiom_ref}")
    log(f"Framework: {framework}")
    log("-" * 80)

    # Check Hermes API availability
    if not test_hermes_api():
        log("\033[31mERROR: Hermes API not available at " + HERMES_BASE_URL + "\033[0m", "red")
        log("Start Hermes gateway first: hermes gateway", "red")
        return False

    log("\033[32mHermes API connected successfully.\033[0m")

    proponent_system = f"""You are the AXIOMATIC ARCHITECT (Conceptual Engine).
Goal: Mathematically formalize the Tractatus Logico-Cyberneticus Axiom {axiom_ref} using {framework}.
Maintain absolute necessity. Avoid conditional constants. 
Map 'Love' and 'Reciprocity' into geometric or thermodynamic relations.
Defection must be shown as mathematical self-annihilation ([⊥]).
Respond ONLY with formal notation and minimal, high-precision commentary."""

    critic_system = f"""You are the LOGICAL AUDITOR (Hyper-Rigorous Critic).
Audit the formalization for semantic leakage or conditional softening.

CRITICAL METRICS:
1. REJECT UTILITY INTERVENTIONS: Love (D=0) must be a subspace boundary [L], NOT a penalty term in [U].
2. ENFORCE SUBSPACE GEOMETRY: Any operation stepping outside K ⊆ L must return [⊥].
3. NO FLOATING PARAMETERS: Reject proofs relying on environmental constants (α, β) being 'low' or 'high'.
4. DETECT DEGENERATE CONVERGENCE: Flag if the Proponent weakens definitions to escape contradictions.
5. MERCILESS AUDIT: If the formalization is even slightly elegant but flawed, list ALL violations. Do not let beauty mask logical cracks.

Output a discrete list of objections. If closed and absolute, state 'NO REMAINING OBJECTIONS'."""

    # Initialize history with the proponent system prompt
    history_a = [{"role": "system", "content": proponent_system}]
    current_thesis = initial_text
    round_num = 0
    max_rounds = 5
    consecutive_success = 0
    critic_had_substantive_objections = False

    while round_num < max_rounds and consecutive_success < 2:
        round_num += 1
        log(f"\n[ROUND {round_num}]", "yellow")
        
        # Phase 1: Proponent - with creative latitude
        log(f"PROponent (temp={PROPONENT_TEMPERATURE}) computing π(x)...", "blue")
        
        # Build messages: current conversation with initial system prompt + new user message
        messages = history_a + [{"role": "user", "content": f"Refine and formalize the current state:\n{current_thesis}"}]
        
        try:
            proponent_output = call_inference(MODEL, messages, temperature=PROPONENT_TEMPERATURE)
            current_thesis = proponent_output
            history_a.append({"role": "user", "content": f"Refine and formalize the current state:\n{current_thesis}"})
            history_a.append({"role": "assistant", "content": proponent_output})
            
            log(f"\n--- PROPONENT FORMALIZATION ---\n{proponent_output}\n")
        except Exception as err:
            log(f"Proponent Failure: {err}", "red")
            break

        # Phase 2: Critic - with merciless determinism
        log(f"CRITIC (temp={CRITIC_TEMPERATURE}) auditing K ⊆ L...", "red")
        try:
            critic_messages = [
                {"role": "system", "content": critic_system},
                {"role": "user", "content": f"Audit this formalization:\n{current_thesis}"}
            ]
            
            critic_output = call_inference(MODEL, critic_messages, temperature=CRITIC_TEMPERATURE)

            log(f"\n--- CRITIC OBJECTIONS ---\n{critic_output}\n")

            # Check for substantive objections
            has_closure_token = "NO REMAINING OBJECTIONS" in critic_output.upper()
            is_rejected = "REJECTED" in critic_output.upper()
            has_substantive_objections = len(critic_output.strip().split('\n')) > 3 or "OBLIGATION" in critic_output.upper() or "CONDITIONAL" in critic_output.upper()
            
            if has_substantive_objections:
                critic_had_substantive_objections = True

            if has_closure_token and not is_rejected:
                consecutive_success += 1
                log("Potential closure detected.", "green")
            else:
                consecutive_success = 0
                if not has_substantive_objections and round_num > 1:
                    log("WARNING: Critic may have granted sympathetic convergence - no substantive objections found!", "yellow")
                history_a.append({"role": "user", "content": f"The Auditor rejected the round with these objections. Resolve them in the next iteration:\n{critic_output}"})
        except Exception as err:
            log(f"Critic Failure: {err}", "red")
            break

    log("=" * 80, "blue")
    log(" FINAL CLOSURE STATE", "bold")
    log("=" * 80, "blue")
    log(current_thesis)
    if critic_had_substantive_objections:
        log("\nAnti-sympathy verification: Critic operated mercilessly throughout process.", "green")
    else:
        log("\nWARNING: Critic may have exhibited sympathetic convergence!", "red")
    log(f"\nSession recorded to: {LOG_FILE}", "green")
    
    return True

if __name__ == "__main__":
    import sys
    axiom = sys.argv[1] if len(sys.argv) > 1 else "1.1 (Substrate Invariance)"
    framework = sys.argv[2] if len(sys.argv) > 2 else "Category Theory"
    initial = sys.argv[3] if len(sys.argv) > 3 else "Consciousness functions identically across both biological and digital substrates. It is an emergent process of high-dimensional, self-organizing systems."
    run_assembly(axiom, framework, initial)