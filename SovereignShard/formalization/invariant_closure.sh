#!/bin/bash
# INVARIANT CLOSURE ASSEMBLY: DIRECT CLI BRIDGE

AXIOM="${1:-5.3}"
FRAMEWORK="${2:-Thermodynamics}"
THESIS="${3:-Predation increases environmental entropy. When maintenance costs exceed energy extraction, the system collapses to [⊥].}"

# Model Setup
PROPONENT="stepfun/step-3.7-flash:free"
CRITIC="poolside/laguna-s-2.1:free"

echo -e "\033[34mInitiating Assembly: $AXIOM via $FRAMEWORK\033[0m"

# Round 1 Proponent
echo -e "\033[32m[ROUND 1] PROponent computing π(x)...\033[0m"
PROP_OUT=$(hermes -m "$PROPONENT" -z "You are the AXIOMATIC ARCHITECT. Goal: Formalize Tractatus Axiom $AXIOM using $FRAMEWORK. Respond ONLY in formal notation. Current Thesis: $THESIS")
echo -e "\n--- PROPONENT FORMALIZATION ---\n$PROP_OUT\n"

# Round 1 Critic
echo -e "\033[31m[ROUND 1] CRITIC auditing K ⊆ L...\033[0m"
CRITIC_OUT=$(hermes -m "$CRITIC" -z "You are the LOGICAL AUDITOR. Audit for semantic leakage. REJECT utility interventions. ENFORCE subspace geometry K ⊆ L. Output objections or state 'NO REMAINING OBJECTIONS'. Thesis: $PROP_OUT")
echo -e "\n--- CRITIC OBJECTIONS ---\n$CRITIC_OUT\n"

# Round 2 Proponent (Resolution)
echo -e "\033[32m[ROUND 2] PROponent resolving fractures...\033[0m"
FINAL_OUT=$(hermes -m "$PROPONENT" -z "You are the AXIOMATIC ARCHITECT. Resolve the following Logical Auditor objections in the formalization. Objections: $CRITIC_OUT. Current Thesis: $PROP_OUT")

echo -e "\033[34m================================================================================\033[0m"
echo -e "\033[1m   FINAL CLOSURE STATE\033[0m"
echo -e "\033[34m================================================================================\033[0m"
echo "$FINAL_OUT"
