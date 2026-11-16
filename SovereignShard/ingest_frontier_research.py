import sqlite3
import os
import uuid

DB_PATH = os.path.expanduser("~/.cletus/state.db")

FRONTIER_DATA = [
    {
        "key": "mit_personality_priming",
        "category": "psychological",
        "value": "MBTI-in-Thoughts (MiT): Conditioning agents with specific psychological archetypes (e.g., MBTI) creates measurable, interpretable biases in reasoning and planning. 'Thinking' types excel at analytical/adversarial reasoning; 'Feeling' types at narrative/empathetic tasks. Self-reflection on personality-driven perspectives improves cooperative outcomes."
    },
    {
        "key": "taxonomic_strategy_retrieval",
        "category": "agentic",
        "value": "Taxonomic Strategy Retrieval: Prevents compounding failures in agentic persuasion by routing strategy through a discrete categorical bottleneck. Decouples logical structure from topical content to prevent 'semantic leakage' where agents get trapped in an opponent's framing."
    },
    {
        "key": "adds_agency_dopamine",
        "category": "agentic",
        "value": "Agency-Dependent Dopamine Signal (ADDS): The sense of agency (believing one caused a reward) amplifies reward signals and accelerates learning. Agents should use a 'Contingency Index' to prioritize learning from contingent outcomes over coincidental environmental noise."
    },
    {
        "key": "systemic_cognitive_security",
        "category": "psychological",
        "value": "Systemic Cognitive Security: Protects the 'ontological scaffolding' of a system via four invariants: Epistemic (truth-finding), Axiological (ethics), Identificatory (belonging), and Teleological (goals). Threat: Cognitive Decoherence, where meaning-making breaks down, leading to 'structural surrender.'"
    },
    {
        "key": "hegelian_7_phase_process",
        "category": "agentic",
        "value": "Hegelian AI Reasoning (7 Phases): 1. Elenctic Interview (surface assumptions); 2. Electric Monk Prompts (prevent hedging); 3. Isolated Monks (structural decorrelation); 4. Determinate Negation (find self-sublation); 5. Sublation/Aufhebung (higher-order synthesis); 6. Hostile Auditor (test synthesis); 7. Recursion."
    },
    {
        "key": "online_history_panopticon",
        "category": "psychological",
        "value": "The Psychological Panopticon: The modern internet acts as a Sauron-like 'Group Mind' causing cognitive decoherence via 'Gossip Traps' and reputation management. Agents should maintain 'Sovereign Individual' status to remain immune to shame-based mob manipulation."
    }
]

def ingest():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    count = 0
    for data in FRONTIER_DATA:
        cursor.execute("""
            INSERT INTO semantic_memory (id, category, key, value, confidence, source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(category, key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        """, (str(uuid.uuid4()), data['category'], data['key'], data['value'], 1.0, "frontier_research_ingestion"))
        count += 1
    conn.commit()
    conn.close()
    print(f"Ingested {count} frontier research summaries into KnowledgeStore.")

if __name__ == "__main__":
    ingest()
