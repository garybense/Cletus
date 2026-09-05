import json
import sqlite3
import os

agents_dir = "/home/debian/.openclaw/agents"
results = []

if os.path.exists(agents_dir):
    for agent_name in os.listdir(agents_dir):
        db_path = os.path.join(agents_dir, agent_name, "agent", "openclaw-agent.sqlite")
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Fetch recent tool run errors
                cursor.execute("SELECT id, provider, outcome, occurred_at FROM message_tool_run_outcomes WHERE run_status != 'success' ORDER BY occurred_at DESC LIMIT 10")
                errors = [{"id": r[0], "tool": r[1], "error": r[2], "time": r[3]} for r in cursor.fetchall()]
                
                # Fetch trajectory runtime events (for execution bugs)
                cursor.execute("SELECT session_id, event_json, created_at FROM trajectory_runtime_events ORDER BY created_at DESC LIMIT 10")
                trajectory_errors = [{"id": r[0], "type": "trajectory_event", "message": r[1], "time": r[2]} for r in cursor.fetchall()]

                # Transcript events
                behavior = []
                try:
                    cursor.execute("SELECT session_id, seq, event_json, created_at FROM transcript_events ORDER BY created_at DESC LIMIT 5")
                    behavior = [{"id": r[0], "type": "transcript_" + str(r[1]), "content": r[2], "time": r[3]} for r in cursor.fetchall()]
                except Exception as e:
                    pass

                results.append({
                    "agent": agent_name,
                    "errors": errors,
                    "trajectory_errors": trajectory_errors,
                    "recent_behavior": behavior
                })
                conn.close()
            except Exception as e:
                results.append({"agent": agent_name, "db_error": str(e)})

print(json.dumps(results))
