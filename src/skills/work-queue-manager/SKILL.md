---
name: work-queue-manager
description: Instructions and operational protocols for managing Cletus work queue items, acceptance predicates, and priority execution.
auto-activate: true
---

# Work Queue Manager Skill

Provides operational guidelines for Cletus when enqueuing, inspecting, retrying, and managing tasks in the autonomous `work_queue`.

## Work Queue Operations

1. **Inspect Pending & Failed Queue Items**:
   - Query pending or failed work items from SQLite:
     ```bash
     sqlite3 ~/.cletus/state.db "SELECT id, source, priority, status, acceptance_predicate, error FROM work_queue ORDER BY priority DESC LIMIT 20;"
     ```

2. **Retry Failed Work Item**:
   - Reset a failed or expired work item back to `pending`:
     ```bash
     sqlite3 ~/.cletus/state.db "UPDATE work_queue SET status = 'pending', claimed_by = NULL, lease_expires_at = NULL, error = NULL WHERE id = 'ITEM_ID';"
     ```

3. **Reprioritize Work Item**:
   - Update the priority of an enqueued task:
     ```bash
     sqlite3 ~/.cletus/state.db "UPDATE work_queue SET priority = 100 WHERE id = 'ITEM_ID';"
     ```
