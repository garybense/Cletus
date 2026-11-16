import time, sqlite3, os, json, datetime

db_path = os.path.expanduser('~/.cletus/state.db')
log_path = os.path.expanduser('~/.cletus/cletus.log')

print("========================================================================")
print(" 🚀 ACTIVE SWARM PRODUCTION & EFFICIENCY MONITOR DAEMON INITIALIZED")
print("========================================================================\n")

last_completed_count = 0

for tick in range(15):
    now_str = datetime.datetime.now().strftime("%H:%M:%S")
    try:
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            c = conn.cursor()

            c.execute("SELECT COUNT(*) FROM task_graph WHERE status = 'completed'")
            completed = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM task_graph WHERE status IN ('assigned', 'running', 'ready')")
            active = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM task_graph WHERE status = 'failed'")
            failed = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM work_queue WHERE status = 'pending'")
            pending_queue = c.fetchone()[0]

            c.execute("SELECT id, title, assigned_to, completed_at FROM task_graph WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1")
            latest_completed = c.fetchone()

            conn.close()

            delta = completed - last_completed_count if last_completed_count > 0 else 0
            last_completed_count = completed

            print(f"[{now_str}] 🟢 LIVE TELEMETRY | Completed: {completed} (+{delta}) | Active: {active} | Failed: {failed} | Queue: {pending_queue}")
            if latest_completed:
                print(f"         ↳ Latest Done: [{latest_completed[0][:10]}] \"{latest_completed[1][:50]}\" (by {latest_completed[2] or 'parent'})")

    except Exception as e:
        print(f"[{now_str}] ⚠️ Monitor Alert: {e}")

    time.sleep(2)
