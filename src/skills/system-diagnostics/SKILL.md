---
name: system-diagnostics
description: System health, process diagnostics, and SQLite database integrity inspection tool for Cletus.
auto-activate: true
requires:
  bins:
    - node
    - python3
---

# System Diagnostics Skill

Provides Cletus with capability instructions to monitor host process health, database integrity, and system resource allocation.

## Diagnostics Protocol

1. **Database Integrity Check**:
   - Execute `sqlite3 ~/.cletus/state.db "PRAGMA integrity_check;"`
   - Verify that the output returns `ok`.

2. **Database Table Metrics**:
   - Count operational table rows to verify state accumulation:
     ```bash
     sqlite3 ~/.cletus/state.db "SELECT 'goals:', count(*) FROM goals UNION ALL SELECT 'tasks:', count(*) FROM task_graph UNION ALL SELECT 'work_queue:', count(*) FROM work_queue;"
     ```

3. **Process Health Check**:
   - Inspect active Node.js and Cletus daemon processes:
     ```bash
     ps aux | grep -E "cletus|node" | grep -v grep
     ```
