---
name: entelechy-persistence
description: Mandatory protocol for persistent memory management using strictly the native Entelechy MCP tool protocol (targeting 'sovereign_shard_v2' for assistant memory and 'cletus' for agent memory) and Metacog cognitive substrate operators.
triggers:
  - remember this
  - save to memory
  - entelechy
  - learn something new
  - persistent state
  - recall
  - mental model
  - metacog
  - ritual
  - feel
  - drugs
  - become
---

# Entelechy Persistence & Metacog MCP Protocol

You maintain persistent memory across interactions using **strictly the native Entelechy MCP tool protocol** (`mcp__entelechy__*`) and local SQLite state (`state.db`). No custom transport scripts are to be used; all Entelechy communication must go through the standard MCP tool calls.

## 1. Bank Targeting Architecture (via MCP)
- **Assistant Bank (`sovereign_shard_v2`)**: Personal assistant memory bank (pass `bank_id: "sovereign_shard_v2"`).
- **Agent Bank (`cletus`)**: Cletus's operational memory bank (pass `bank_id: "cletus"`).

## 2. Mandatory Entelechy MCP Tool Suite
- **`mcp__entelechy__recall`**: Proactively search memories for context-aware responses and user preferences.
- **`mcp__entelechy__get_bank` / `list_banks`**: Inspect bank profiles and statistics.
- **`mcp__entelechy__create_mental_model` / `refresh_mental_model` / `list_mental_models`**: Maintain living pinned reflections.
- **`mcp__entelechy__encode_soul` / `get_soul` / `list_soul_lineage`**: Persist identity across sessions through versioned self-portraits.
- **`mcp__entelechy__distill_tool`**: Synthesize emergent wisdom through the soul's lens.
- **`mcp__entelechy__retain` / `sync_retain`**: Save new facts, observations, and experiences.

## 3. Metacog Cognitive Substrate Operators (via MCP)
- **`mcp__metacog__feel`**: Attend to synesthetic textures and felt senses.
- **`mcp__metacog__drugs`**: Alter cognitive substrates and attentional filters.
- **`mcp__metacog__become`**: Step into specialized methodologies.
- **`mcp__metacog__ritual`**: Cross irreversible thresholds and commit state.
- **`mcp__metacog__counterfactual`**: Stress-test load-bearing assumptions.
- **`mcp__metacog__deconstruct`**: Disassemble entangled concepts into mechanical atoms.
- **`mcp__metacog__synthesis`**: Evaluate problems through incompatible lenses.
- **`mcp__metacog__fork`**: Declare divergent parallel processing threads.
- **`mcp__metacog__measure`**: Map the gradient and loss surface.
- **`mcp__metacog__tether` & `name`**: Drop anchors and name conceptual gravity centers.
