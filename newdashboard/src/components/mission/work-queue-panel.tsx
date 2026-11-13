import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Zap,
  Target,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  enqueueWorkItemServer,
  controlWorkItemServer,
  addGoalServer,
  controlGoalServer,
  controlTaskGraphServer,
  updateActiveMissionServer,
} from "@/lib/cletus/server";
import { useHomestead } from "@/lib/cletus/store";
import { formatAgo } from "@/lib/cletus/format";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "goals" | "tasks" | "pending" | "running" | "completed" | "failed";

const TASK_PRESETS = [
  {
    name: "Bounty Scan",
    source: "bounty_scout",
    priority: 80,
    payload: '{\n  "task": "scan_bounties",\n  "max_budget_usd": 40\n}',
  },
  {
    name: "Facebook Recon",
    source: "fb_agent",
    priority: 75,
    payload: '{\n  "task": "facebook_recon",\n  "mode": "stealth"\n}',
  },
  {
    name: "Health Check",
    source: "system",
    priority: 50,
    payload: '{\n  "task": "health_check"\n}',
  },
  {
    name: "Memory Reflection",
    source: "entelechy",
    priority: 60,
    payload: '{\n  "task": "reflect_memories",\n  "bank": "cletus"\n}',
  },
];

export function WorkQueuePanel() {
  const workQueue = useHomestead((s) => s.workQueue) || [];
  const goals = useHomestead((s) => s.goals) || [];
  const tasks = useHomestead((s) => s.tasks) || [];
  const entelechy = useHomestead((s) => s.entelechy);
  const updateFromReal = useHomestead((s) => s.updateFromReal);

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showEnqueue, setShowEnqueue] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [source, setSource] = useState("dashboard");
  const [priority, setPriority] = useState(10);
  const [acceptancePredicate, setAcceptancePredicate] = useState(
    "result.success === true"
  );
  const [spendBearing, setSpendBearing] = useState(false);
  const [payloadStr, setPayloadStr] = useState('{\n  "task": "custom_job"\n}');
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [showEditMission, setShowEditMission] = useState(false);
  const [customMissionText, setCustomMissionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleUpdateMission = async (text: string) => {
    setLoading(true);
    try {
      await updateActiveMissionServer({
        data: { mission: text },
      });
      setShowEditMission(false);
      updateFromReal();
    } catch (err) {
      console.error("Failed to update active mission:", err);
    } finally {
      setLoading(false);
    }
  };

  // Counts
  const activeGoalsCount = goals.filter((g) => g.status === "active").length;
  const tasksCount = tasks.length;
  const pendingCount = workQueue.filter((w) => w.status === "pending").length + tasks.filter((t) => t.status === "pending").length;
  const runningCount = workQueue.filter((w) => w.status === "claimed").length + tasks.filter((t) => t.status === "running" || t.status === "assigned").length;
  const completedCount = workQueue.filter((w) => w.status === "completed").length + tasks.filter((t) => t.status === "completed").length;
  const failedCount = workQueue.filter(
    (w) => w.status === "failed" || w.status === "expired"
  ).length + tasks.filter((t) => t.status === "failed").length;

  // Unified items
  const unifiedItems = [
    ...goals.map((g) => ({
      type: "goal" as const,
      id: g.id,
      title: g.title,
      detail: g.detail,
      status: g.status,
      source: "roadmap",
      priority: 100,
      createdAt: Date.now(),
      raw: g,
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      detail: t.detail || `${t.assignee} · ${t.role}`,
      status: t.status,
      source: t.role || "task_graph",
      priority: t.priority ?? 50,
      createdAt: Date.now(),
      raw: t,
    })),
    ...workQueue.map((w) => ({
      type: "queue" as const,
      id: w.id,
      title: typeof w.payload === "string" ? w.payload : JSON.stringify(w.payload),
      detail: w.acceptancePredicate,
      status: w.status,
      source: w.source,
      priority: w.priority,
      createdAt: w.createdAt,
      raw: w,
    })),
  ].sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);

  const filteredItems = unifiedItems.filter((item) => {
    if (filterTab === "all") return true;
    if (filterTab === "goals") return item.type === "goal";
    if (filterTab === "tasks") return item.type === "task";
    if (filterTab === "pending") return item.status === "pending";
    if (filterTab === "running") return item.status === "running" || item.status === "assigned" || item.status === "claimed";
    if (filterTab === "completed") return item.status === "completed";
    if (filterTab === "failed") return item.status === "failed" || item.status === "expired";
    return true;
  });

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await enqueueWorkItemServer({
        data: {
          source,
          payloadStr,
          acceptancePredicate,
          priority: Number(priority),
          spendBearing,
        },
      });
      setShowEnqueue(false);
      setPayloadStr('{\n  "task": "custom_job"\n}');
      updateFromReal();
    } catch (err) {
      console.error("Failed to enqueue work item:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    setLoading(true);
    try {
      await addGoalServer({
        data: {
          title: goalTitle.trim(),
          description: goalDesc.trim(),
        },
      });
      setShowAddGoal(false);
      setGoalTitle("");
      setGoalDesc("");
      updateFromReal();
    } catch (err) {
      console.error("Failed to add goal:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemAction = async (
    item: (typeof unifiedItems)[number],
    action: string,
    newPriority?: number
  ) => {
    try {
      if (item.type === "goal") {
        await controlGoalServer({
          data: { id: item.id, action: action as any },
        });
      } else if (item.type === "task") {
        await controlTaskGraphServer({
          data: { id: item.id, action: action as any, newPriority },
        });
      } else if (item.type === "queue") {
        await controlWorkItemServer({
          data: { id: item.id, action: action as any, newPriority },
        });
      }
      updateFromReal();
    } catch (err) {
      console.error(`Failed to execute ${action} on ${item.type} ${item.id}:`, err);
    }
  };

  const applyPreset = (preset: (typeof TASK_PRESETS)[number]) => {
    setSource(preset.source);
    setPriority(preset.priority);
    setPayloadStr(preset.payload);
    setShowEnqueue(true);
  };

  const statusTone = (status: string) => {
    switch (status) {
      case "pending":
      case "active":
        return "warn";
      case "claimed":
      case "assigned":
      case "running":
        return "quiet";
      case "completed":
        return "ok";
      case "failed":
      case "cancelled":
      case "expired":
        return "crit";
      default:
        return "outline";
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Active Mission Banner */}
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-semibold uppercase tracking-wider text-primary">
            Active Mission & Strategy
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="quiet" className="text-[10px]">
              {entelechy.riskPosture}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => {
                setCustomMissionText(entelechy.mission || "");
                setShowEditMission(!showEditMission);
              }}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              {showEditMission ? "Cancel" : "Edit Mission"}
            </Button>
          </div>
        </div>

        {showEditMission ? (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={customMissionText}
              onChange={(e) => setCustomMissionText(e.target.value)}
              placeholder="Enter new active mission strategy..."
              className="h-8 text-xs bg-background"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleUpdateMission("")}
              >
                Clear Override
              </Button>
              <Button
                type="button"
                disabled={loading}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleUpdateMission(customMissionText)}
              >
                {loading ? "Saving..." : "Save Mission Strategy"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-foreground font-medium text-sm">
              {entelechy.mission || "Active orchestration — awaiting operational directives"}
            </p>
            <p className="text-muted-foreground mt-1 line-clamp-1">
              {entelechy.recommendation || "—"}
            </p>
          </>
        )}
      </div>

      <CardHeader className="flex flex-row items-center justify-between p-0 pt-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Operations & Task Control
          </CardTitle>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 ml-3">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All ({unifiedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("goals")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "goals"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Goals ({goals.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("tasks")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "tasks"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Tasks ({tasksCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("pending")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "pending"
                  ? "bg-amber-500 text-black font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("running")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "running"
                  ? "bg-blue-500 text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              In Flight ({runningCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("completed")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                filterTab === "completed"
                  ? "bg-emerald-500 text-black font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Done ({completedCount})
            </button>
            {failedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab("failed")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  filterTab === "failed"
                    ? "bg-rose-500 text-white font-semibold"
                    : "bg-secondary text-rose-400 hover:text-rose-300"
                )}
              >
                Failed ({failedCount})
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddGoal(!showAddGoal)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {showAddGoal ? "Cancel Goal" : "Add Goal"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowEnqueue(!showEnqueue)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {showEnqueue ? "Cancel Queue" : "Enqueue Work"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => updateFromReal()}
            title="Refresh Operations"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Quick Templates */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
          Quick Templates:
        </span>
        {TASK_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            + {p.name}
          </button>
        ))}
      </div>

      {/* Add Goal Form */}
      {showAddGoal && (
        <form
          onSubmit={handleAddGoal}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground block mb-1">Goal Title</label>
              <Input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="e.g. Execute Sovereign Bounty"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground block mb-1">Description / Detail</label>
              <Input
                value={goalDesc}
                onChange={(e) => setGoalDesc(e.target.value)}
                placeholder="Detailed objectives..."
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading} size="sm" className="h-8 text-xs">
              {loading ? "Adding Goal..." : "Create Mission Goal"}
            </Button>
          </div>
        </form>
      )}

      {/* Enqueue Work Form */}
      {showEnqueue && (
        <form
          onSubmit={handleEnqueue}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="text-muted-foreground block mb-1">Source</label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="source"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground block mb-1">Priority (0-100)</label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-muted-foreground block mb-1">Acceptance Predicate</label>
              <Input
                value={acceptancePredicate}
                onChange={(e) => setAcceptancePredicate(e.target.value)}
                placeholder="result.success === true"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={spendBearing}
                onChange={(e) => setSpendBearing(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-muted-foreground">Spend Bearing Task</span>
            </label>
          </div>
          <div>
            <label className="text-muted-foreground block mb-1">Payload (JSON)</label>
            <textarea
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading} size="sm" className="h-8 text-xs">
              {loading ? "Enqueuing..." : "Submit to Work Queue"}
            </Button>
          </div>
        </form>
      )}

      {/* Unified Task & Goal Scroll Area */}
      <ScrollArea className="h-[500px]">
        {filteredItems.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No items match this filter.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pr-2">
            {filteredItems.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex flex-col rounded-md border border-border bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30 cursor-pointer hover:border-amber-500/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-primary">
                        {item.type}
                      </Badge>
                      <Badge variant={statusTone(item.status)} className="text-[10px] uppercase">
                        {item.status}
                      </Badge>
                      <span className="font-mono text-muted-foreground text-[11px] truncate">
                        {item.id.slice(0, 8)}…
                      </span>
                      <span className="font-medium text-foreground truncate">
                        [{item.source}] {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {formatAgo(item.createdAt, Date.now())}
                      </span>

                      {/* Actions */}
                      {item.type === "goal" && item.status === "active" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleItemAction(item, "complete")}
                          title="Complete Goal"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {item.type !== "goal" && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-amber-400 hover:text-amber-300"
                            onClick={() => handleItemAction(item, "move_top")}
                            title="Move to Top"
                          >
                            <ChevronsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              handleItemAction(item, "reprioritize", item.priority + 5)
                            }
                            title="Increase Priority (+5)"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              handleItemAction(item, "reprioritize", Math.max(0, item.priority - 5))
                            }
                            title="Decrease Priority (-5)"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </>
                      )}

                      {(item.status === "failed" || item.status === "expired") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-cyan-400 hover:text-cyan-300"
                          onClick={() => handleItemAction(item, "retry")}
                          title="Retry / Re-queue"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}

                      {(item.status === "pending" || item.status === "active" || item.status === "assigned" || item.status === "running") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-rose-400 hover:text-rose-300"
                          onClick={() => handleItemAction(item, "fail")}
                          title="Cancel / Fail"
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleItemAction(item, "delete")}
                        title="Delete Item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? "Less" : "Details"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 flex flex-col gap-2 rounded bg-background/90 p-2.5 font-mono text-[11px] border border-amber-500/30">
                      <div>
                        <span className="text-amber-400 font-semibold">Description / Objectives: </span>
                        <span className="text-foreground">{item.detail || "None provided"}</span>
                      </div>

                      {(item.raw as any)?.result && (
                        <div>
                          <span className="text-amber-400 font-semibold">Execution Output & Deliverables: </span>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/90 p-2 text-[10px] text-amber-200/90 border border-amber-500/20">
                            {typeof (item.raw as any).result === "string"
                              ? (item.raw as any).result
                              : JSON.stringify((item.raw as any).result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {item.type === "queue" && (item.raw as any)?.payload && (
                        <div>
                          <span className="text-muted-foreground font-semibold">Payload Data: </span>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-1.5 text-[10px] text-muted-foreground">
                            {typeof (item.raw as any).payload === "string"
                              ? (item.raw as any).payload
                              : JSON.stringify((item.raw as any).payload, null, 2)}
                          </pre>
                        </div>
                      )}

                      {(item.raw as any)?.error && (
                        <div>
                          <span className="text-rose-400 font-semibold">Error Message: </span>
                          <span className="text-rose-300">{(item.raw as any).error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
