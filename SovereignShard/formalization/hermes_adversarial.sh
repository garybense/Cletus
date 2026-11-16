#!/bin/bash

# ==============================================================================
# INVARIANT CLOSURE ASSEMBLY: HERMES PROTOCOL (LOCAL)
# ==============================================================================
#
# This script implements an adversarial dialectic process using local Hermes Agent
# for the Tractatus Logico-Cyberneticus formalization.
#
# ARCHITECTURE:
# - Proponent: Conceptual architect (temp=0.5) - via system prompt positioning
# - Critic: Hyper-rigorous auditor (temp=0.0) - via system prompt positioning
#
# Uses Local Hermes API endpoint: http://localhost:8642/v1
# Single free model (hermes-agent) with role differentiation via system prompts
#
# ANTI-SYMPATHY CONVERGENCE:
# - Different temperatures prevent both agents from converging on the same bias
# - Critic is explicitly forbidden from leniency toward elegant but flawed arguments
# - Role differentiation achieved via system prompts
# ==============================================================================

AXIOM="${1:-1.1}"
FRAMEWORK="${2:-Category Theory}"
INITIAL_TEXT="${3:-Consciousness functions identically across substrates.}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/Users/user/code/CletusWork/Invariant_Closure_$(date +%Y%m%d_%H%M%S).log"

# Hermes API Configuration (local)
HERMES_API_KEY="catfartscatfarts"
HERMES_BASE_URL="http://localhost:8642/v1"

# Single free model with role differentiation
MODEL="hermes-agent"

# Anti-Sympathy Convergence Temperatures
PROPONENT_TEMPERATURE=0.5    # Creative latitude for novel mathematical representations
CRITIC_TEMPERATURE=0.0       # Merciless, deterministic auditing

log() {
  echo -e "$1" | tee -a "$LOG_FILE"
}

# Test Hermes API health
test_hermes_api() {
  local health_status
  health_status=$(curl -s -H "Authorization: Bearer $HERMES_API_KEY" "$HERMES_BASE_URL/health" 2>/dev/null)
  if echo "$health_status" | grep -q "ok"; then
    return 0
  fi
  return 1
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

clear
log "\033[34m================================================================================\033[0m"
log "\033[1m   INVARIANT CLOSURE ASSEMBLY: TRACTATUS FORMALIZATION\033[0m"
log "\033[36m   Wire: Hermes-Agent => Hermes-Agent\033[0m"
log "\033[34m   Role: Proponent => Critic\033[0m"
log "\033[34m================================================================================\033[0m"
log "Using Local Hermes Agent /w $HERMES_BASE_URL"
log "--------------------------------------------------------------------------------"
log "Architecture: Proponent (temp=$PROPONENT_TEMPERATURE) => Critic (temp=$CRITIC_TEMPERATURE)"
log "Model: $MODEL (role differentiation via system prompts)"
log "Axiom: $AXIOM"
log "Framework: $FRAMEWORK"
log "--------------------------------------------------------------------------------"

# Check Hermes API availability
if ! test_hermes_api; then
  log "\033[31mERROR: Hermes API not available at $HERMES_BASE_URL\033[0m"
  log "Start Hermes gateway first: hermes gateway"
  exit 1
fi

log "\033[32mHermes API connected successfully.\033[0m"

# Run the Python implementation (which correctly uses Hermes API)
exec python3 "$SCRIPT_DIR/formalize_tractatus.py" "$AXIOM" "$FRAMEWORK" "$INITIAL_TEXT"