Architecture and failure-mode report

Inspection is complete. I made no repository changes.

1. Runtime entrypoints and control planes

The system has two overlapping execution systems:
1. Core ReAct loop
- Main implementation:  src/agent/loop.ts 
- Flow: wake → gather inputs → retrieve memory → build context → inference → execute tools → persist turn → inspect loops/sleep state.
- This is the process that repeatedly invokes the model.
2. Goal/task orchestrator
- Main implementation:  src/orchestration/orchestrator.ts 
- Runs once per parent-loop iteration through  orchestrator.tick() .
- State machine:
 idle → classifying → planning → plan_review → executing → complete/failed/replanning 
- It manages goals, task graphs, agents, funding, assignments, and result collection.

The two systems share the same SQLite database and are coupled inside  runAgentLoop , but they have different notions of progress and completion.

────────────────────────────────────────────────────────────────────────────────

2. Prompt intake and priority

Inputs can arrive from:
- Initial wakeup prompt.
- SQLite inbox messages.
- Heartbeat wake events.
- Orchestrator-generated directives.
- Loop-detection interventions.
- No-action nudges.
- Creator messages.
- Peer/child messages.
- Dashboard/decree paths.
- Direct model continuation after tool results.

Inbox processing in the core loop:
1.  claimInboxMessages(db.raw, 10)  changes messages from received to in-progress.
2. Messages are formatted and appended to  pendingInput .
3. Creator messages are recognized by case-insensitive address comparison.
4. Creator messages receive  <creator_decree>  formatting and  inputSource: "creator" .
5. Peer messages receive  [Peer Agent Message ...]  formatting and  inputSource: "agent" .
6. The turn, tool calls, and inbox acknowledgements are persisted atomically.
7. Successful messages are marked processed; failed model turns can reset or fail messages based on retry counts.

The orchestration messaging layer has its own priority ordering, with critical messages processed before high and normal messages. Heartbeat schedules are sorted by numeric priority, with lower values first.

Critical prompt-loss defect

After inbox messages are placed into  pendingInput , the orchestrator can overwrite them:

// ts
pendingInput = {
  content: "ORCHESTRATOR STATUS: idle ...",
  source: "system",
};

This occurs when there are no active goals, workers, or tasks. Consequently, a creator decree or peer message can be claimed successfully but never reach the model. This explains the failed decree and peer-message tests.

The same issue can affect loop-warning and maintenance interventions because multiple subsystems independently replace  pendingInput  rather than enqueueing prioritized inputs.

────────────────────────────────────────────────────────────────────────────────

3. Scheduling and frequency

There are three distinct timing mechanisms:

Core agent loop

- Runs continuously while  running === true .
- There is no durable queue scheduler between ordinary turns.
- Each turn can immediately trigger another inference request.
-  sleep_until  is the primary stop signal.
- Explicit  sleep , cycle limits, error limits, and idle limits terminate the current loop.
- The outer runtime is responsible for starting another cycle after sleeping.

Heartbeat scheduler

- Implemented in  src/heartbeat/scheduler.ts  and  src/heartbeat/daemon.ts .
- Uses persisted heartbeat schedule rows.
- Supports cron and interval scheduling.
- Has overlap prevention with a  tickInProgress  guard.
- Has task leases, timeouts, retries, execution history, wake events, and deduplication keys.
- The default interval is 60 seconds.
- Low-compute mode multiplies the interval, normally by four.

Orchestrator

- Not a separate durable worker loop in this application.
- It is called once per parent agent turn.
- Therefore, orchestration progress depends on the core model loop continuing to run.
- If the parent sleeps, orchestration does not independently advance unless another daemon/process invokes it.

This coupling is a major architectural risk: the model is simultaneously the worker, scheduler driver, planner, and supervisor.

────────────────────────────────────────────────────────────────────────────────

4. Completion behavior

There is no reliable semantic “the requested task is complete” signal in the core loop.

The loop stops when one of these occurs:
- The model calls  sleep .
- A sleep deadline is encountered.
- A cycle limit is reached.
- Consecutive inference errors reach the limit.
- Idle/no-action thresholds are reached.
- Loop-enforcement logic forces sleep.
- A blocked  create_goal  call triggers a 30-second backoff.

A text response such as “Done” does not represent completion. If the model had non-wakeup input and returns text without tools, the loop injects another nudge:
> “You had a task to do ... but produced no tool calls.”


This can repeat until a hard limit or timeout. That behavior directly matches the observed “it is done accomplishing what it is asked, but continues looping” symptom.

The orchestrator has task completion through  task_done  and SQLite task status transitions, but that completion is not consistently propagated back into the core loop’s notion of whether it should stop.

────────────────────────────────────────────────────────────────────────────────

5. Confirmed loop defects

A. Repetition threshold is incorrectly set to one

 src/agent/loop.ts  contains:

// ts
const MAX_REPETITIVE_TURNS = 1;

The code then treats one tool-call turn as a repeated pattern. The next matching turn is enforced as a loop. This contradicts the intended three-turn behavior and the separate  LoopDetector  implementation, whose defaults are three identical calls and three idle-only turns.

The main loop appears to duplicate loop-detection logic instead of using  LoopDetector  consistently.

B. Maintenance-loop threshold is also effectively one

The same constant controls:

// ts
if (idleToolTurns >= MAX_REPETITIVE_TURNS)

Therefore, a single idle-only status-check turn can trigger a maintenance intervention. Tests expecting three consecutive idle-only turns fail.

C. Warning and enforcement state are inconsistent

The main loop maintains:
-  lastToolPatterns 
-  loopWarningPattern 
-  idleToolTurns 
-  zeroToolCallTurns 

Separately,  src/agent/loop-detector.ts  maintains its own:
- Call history
- Turn patterns
- Idle-only counter
- Warning state

These are not unified. The resulting warning/enforcement semantics differ depending on which path is active.

D. Loop intervention messages compete with real work

Loop warnings, orchestrator directives, inbox messages, no-action nudges, and wakeup prompts all write directly to one  pendingInput  variable. There is no explicit priority queue. A lower-priority status directive can replace a creator decree or task message.

E. “No action” is interpreted as a reason to continue

When the model returns text without tools for a task-bearing input, the loop intentionally creates another input and invokes inference again. This is a direct continuation loop unless the model eventually calls a tool or hits a limit.

F. Delegated-work branch contradicts its intended behavior

The branch for active delegated work logs a message saying the parent should not sleep, but the historical test and surrounding design expect the parent to stop invoking inference when no self-assigned task remains. The current implementation continues model calls, which caused:

// text
expected inference.calls.length to be 0
received 25

────────────────────────────────────────────────────────────────────────────────

6. Parent/child lifecycle

Local workers

- Implemented by  LocalWorkerPool .
- Run in-process as asynchronous tasks.
- Use harnesses registered through  HarnessRegistry .
- Receive an inference bridge based on the parent’s inference client.
- Update task state directly in SQLite.
- Can use specialized harnesses, including orchestrator, coding, general, and Freebuff-related harnesses.

Local workers therefore do not need a  task_result  message to complete a task.

Remote/OpenClaw children

-  src/replication/openclaw-spawner.ts  provisions a workspace remotely or through SSH.
- It creates an  AGENTS.md , links skills, synchronizes API keys, and registers a child row in SQLite.
-  runOpenClawChildTurn()  sends instructions with the OpenClaw CLI.
-  src/replication/messaging.ts  sends parent/child messages through the social relay.

However, this repository does not show a complete remote child result-return path. In particular, there is no visible implementation where an OpenClaw child executes a task and reliably emits an orchestration-format  task_result  message back into the parent’s task-result collector.

Spawn fallback

The orchestrator first tries Mindmods sandbox spawning through  replication/spawn.ts . On failure, it can fall back to  LocalWorkerPool . Some direct agent tools separately invoke OpenClaw spawning. This creates multiple child creation paths with different lifecycle semantics.

────────────────────────────────────────────────────────────────────────────────

7. Messaging defects and transport mismatch

There are two messaging systems:
1.  src/replication/messaging.ts 
- Social relay.
- Parent/child JSON payloads.
- Used by direct child-management tools.
2.  src/orchestration/messaging.ts 
- Typed colony messages.
- Handles  task_assignment ,  task_result ,  status_report , alerts, resource requests, and other message types.
- Reads from the same general inbox database.

The orchestrator’s  collectResults()  only consumes processed messages of type  task_result .

The important mismatch is:
- Local workers complete tasks directly in SQLite.
- The orchestrator also expects task results through  task_result  messages.
- Remote children do not have a complete visible result-emission implementation.
- The core agent loop independently claims and processes inbox messages as natural-language prompts.

Thus, there are competing consumers and completion protocols sharing the same inbox.

This can cause:
- Orchestration messages being consumed as ordinary prompts.
- Task-result messages being acknowledged before the orchestrator sees them.
- Child work completing in the database but remaining invisible to  collectResults() .
- Parent tasks remaining assigned/running even though a worker completed them.

────────────────────────────────────────────────────────────────────────────────

8. Persistence and state

SQLite is the durable coordination layer. It stores, among other things:
- Agent state and key/value runtime state.
- Turns and tool calls.
- Inbox messages and retry state.
- Wake events.
- Heartbeat schedules and execution history.
- Leases and deduplication keys.
- Goals and task graphs.
- Child agent records.
- Working, episodic, semantic, procedural, relationship, and shared knowledge memory.
- Financial balance cache.
- Orchestrator state and generated todo context.

The core loop persists a turn, tool calls, and inbox acknowledgements in one transaction, which is a strong design choice. However, state transitions across the core loop and orchestrator are not transactional as a single unit.

Examples:
- A task may be marked assigned while the parent later sleeps.
- An inbox message may be marked processed while its orchestration effect is not applied.
- Orchestrator state and task state can advance independently.
- Child health and task assignment can become stale.

────────────────────────────────────────────────────────────────────────────────

9. Memory systems

There are three memory paths:

Local memory

 MemoryRetriever  retrieves, in order:
1. Working memory
2. Episodic memory
3. Semantic memory
4. Procedural memory
5. Relationships

The result is constrained by a token budget.

Local ingestion

After each turn,  MemoryIngestionPipeline  processes the turn and tool calls. Goal completion and other significant events can be archived into episodic memory.

Entelechy

The repository currently:
- Calls  recall  against Entelechy during every agent-loop iteration.
- Uses bank  "cletus" .
- Calls  retain  for selected skill-creation and revenue events.
- Calls  reflect  for revenue-strategy reflection.
- Uses a legacy JSON-RPC  tools/call  request against  https://mindmods.org/mcp .
- Silently ignores retrieval failures in the main loop.

The current client does not implement the documented newer Entelechy orchestration flow:
-  /v1/default/banks/{bank_id}/sessions/bootstrap 
-  /v1/default/memories/retain_async 

The server landing response advertises  start_here  through a POST request, but the repository has no onboarding sequence that calls it, interprets its response, and configures the correct bank/transport.

I did not send anything to Entelechy or retain this report externally. No usable authenticated onboarding/retention path was present through the available integration, and the existing client does not establish that onboarding.

────────────────────────────────────────────────────────────────────────────────

10. Financial fallback inconsistency

The heartbeat context uses a fallback of  1000  credits when the balance API fails:

// ts
creditBalance = 1000;

The focused test expects zero credits and a critical survival tier. The agent loop also uses a  $10  operational baseline in its own financial fallback path.

There are therefore inconsistent policies for “unknown balance”:
- Heartbeat: normal operational baseline.
- Core loop: cached value, then normal  $10  baseline.
- Test expectation: zero/critical.
- Other code paths use  -1  to represent API unreachable.

This ambiguity can cause the cletus to continue spending when balance is unknown or, depending on the path, enter low-compute/dead behavior.

────────────────────────────────────────────────────────────────────────────────

Verification results

Command run:

// bash
pnpm typecheck
pnpm vitest run src/__tests__/loop.test.ts src/__tests__/heartbeat-scheduler.test.ts src/__tests__/orchestration/orchestrator.test.ts src/__tests__/orchestration/local-worker-harness.test.ts

Results:
- Typecheck: passed
- Orchestrator tests: 26 passed
- Local worker harness tests: 5 passed
- Heartbeat scheduler tests: 19 passed, 1 failed
- Agent loop tests: 15 passed, 12 failed
- Overall focused result: 65 passed, 13 failed

The failures are consistent with the defects above, particularly:
- Inbox/decree messages disappearing before inference.
- Text-only completion causing repeated inference.
- Incorrect repetition thresholds.
- Maintenance detection firing at the wrong count.
- Delegated-work branch continuing inference.
- Balance fallback disagreement.

The working tree already contained numerous modified and untracked files before/through this inspection. I did not modify them.

Highest-priority redesign recommendations

1. Replace  pendingInput  with a durable, typed priority queue.
2. Establish one owner for inbox claiming and message acknowledgement.
3. Separate orchestration messages from conversational prompts.
4. Define one completion protocol shared by the core loop, local workers, and remote children.
5. Make the parent loop event-driven rather than model-driven for scheduling.
6. Remove duplicated loop-detection implementations and restore explicit thresholds.
7. Treat “done” as a first-class state transition, not merely model text.
8. Make unknown financial state explicit and consistent across heartbeat and core runtime.
9. Integrate Entelechy through its current bootstrap/writeback API only after a proper onboarding contract is established.
10. Keep child lifecycle, task assignment, result delivery, and health monitoring on one transport/state model.


