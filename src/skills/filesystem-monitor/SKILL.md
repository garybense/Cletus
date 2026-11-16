---
name: filesystem-monitor
description: File change tracking, workspace monitoring, and log activity auditing for Cletus.
auto-activate: true
requires:
  bins:
    - node
---

# FileSystem Monitor Skill

Allows Cletus to audit workspace file modifications, tail activity logs, and detect uncommitted workspace changes.

## Monitoring Protocol

1. **Log Tail Audit**:
   - Inspect recent raw log output in `~/.cletus/cletus.log`:
     ```bash
     tail -n 30 ~/.cletus/cletus.log
     ```

2. **Workspace Change Detection**:
   - Audit git workspace modification status:
     ```bash
     git status --short
     ```

3. **Artifact Directory Audit**:
   - Check sorted legacy artifacts in `legacy_artifacts/`:
     ```bash
     ls -la legacy_artifacts/
     ```
