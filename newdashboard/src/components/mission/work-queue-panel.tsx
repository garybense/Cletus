import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  enqueueWorkItemServer,
  controlWorkItemServer,
} from "@/lib/cletus/server";
import { useHomestead } from "@/lib/cletus/store";
import type { WorkItem, WorkItemStatus } from "@/lib/cletus/types";
import { formatAgo } from "@/lib/cletus/format";

export function WorkQueuePanel() {
  const workQueue = useHomestead((s) => s.workQueue) || [];
  const updateFromReal = useHomestead((s) => s.updateFromReal);

  const [showEnqueue, setShowEnqueue] = useState(false);
  const [source, setSource] = useState("dashboard");
  const [priority, setPriority] = useState(10);
  const [acceptancePredicate, setAcceptancePredicate] = useState(
    "result.success === true"
  );
  const [spendBearing, setSpendBearing] = useState(false);
  const [payloadStr, setPayloadStr] = useState('{\n  "task": "custom_job"\n}');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingCount = workQueue.filter((w) => w.status === "pending").length;
  const claimedCount = workQueue.filter((w) => w.status === "claimed").length;
  const completedCount = workQueue.filter((w) => w.status === "completed").length;
  const failedCount = workQueue.filter(
    (w) => w.status === "failed" || w.status === "expired"
  ).length;

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

  const handleAction = async (
    id: string,
    action: "retry" | "fail" | "delete" | "reprioritize",
    newPriority?: number
  ) => {
    try {
      await controlWorkItemServer({
        data: { id, action, newPriority },
      });
      updateFromReal();
    } catch (err) {
      console.error(`Failed to execute ${action} on item ${id}:`, err);
    }
  };

  const statusTone = (status: WorkItemStatus) => {
    switch (status) {
      case "pending":
        return "warn";
      case "claimed":
        return "quiet";
      case "completed":
        return "ok";
      case "failed":
      case "expired":
        return "crit";
      default:
        return "outline";
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Work Queue Control
          </CardTitle>
          <div className="flex items-center gap-1.5 ml-2">
            <Badge variant="outline" className="text-xs">
              {pendingCount} Pending
            </Badge>
            <Badge variant="outline" className="text-xs">
              {claimedCount} Claimed
            </Badge>
            <Badge variant="ok" className="text-xs">
              {completedCount} Done
            </Badge>

            {failedCount > 0 && (
              <Badge variant="crit" className="text-xs">
                {failedCount} Failed
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowEnqueue(!showEnqueue)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {showEnqueue ? "Cancel" : "Enqueue Work"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => updateFromReal()}
            title="Refresh Queue"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

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
              <label className="text-muted-foreground block mb-1">Priority</label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-muted-foreground block mb-1">
                Acceptance Predicate
              </label>
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
            <label className="text-muted-foreground block mb-1">
              Payload (JSON)
            </label>
            <textarea
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="h-8 text-xs"
            >
              {loading ? "Enqueuing..." : "Submit to Work Queue"}
            </Button>
          </div>
        </form>
      )}

      <ScrollArea className="h-[280px]">
        {workQueue.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No work items in queue
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pr-2">
            {workQueue.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={item.id}
                  className="flex flex-col rounded-md border border-border bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant={statusTone(item.status)} className="text-[10px] uppercase">
                        {item.status}
                      </Badge>
                      <span className="font-mono text-muted-foreground text-[11px] truncate">
                        {item.id.slice(0, 8)}…
                      </span>
                      <span className="font-medium text-foreground truncate">
                        [{item.source}] P:{item.priority}
                      </span>
                      {item.spendBearing && (
                        <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">
                          $$$
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {formatAgo(item.createdAt, Date.now())}
                      </span>

                      {/* Reprioritize */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          handleAction(item.id, "reprioritize", item.priority + 5)
                        }
                        title="Increase Priority"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          handleAction(
                            item.id,
                            "reprioritize",
                            Math.max(0, item.priority - 5)
                          )
                        }
                        title="Decrease Priority"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>

                      {/* Retry / Fail controls */}
                      {(item.status === "failed" ||
                        item.status === "expired" ||
                        item.status === "claimed") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-cyan-400 hover:text-cyan-300"
                          onClick={() => handleAction(item.id, "retry")}
                          title="Re-queue / Retry"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}

                      {(item.status === "pending" ||
                        item.status === "claimed") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-rose-400 hover:text-rose-300"
                          onClick={() => handleAction(item.id, "fail")}
                          title="Cancel / Fail"
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}

                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleAction(item.id, "delete")}
                        title="Delete Item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                      >
                        {isExpanded ? "Less" : "Details"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 flex flex-col gap-1 rounded bg-background/80 p-2 font-mono text-[11px] border border-border/50">
                      <div>
                        <span className="text-muted-foreground">Predicate: </span>
                        <span>{item.acceptancePredicate}</span>
                      </div>
                      {item.claimedBy && (
                        <div>
                          <span className="text-muted-foreground">Claimed By: </span>
                          <span>{item.claimedBy}</span>
                        </div>
                      )}
                      {item.error && (
                        <div className="text-rose-400">
                          <span className="text-muted-foreground">Error: </span>
                          <span>{item.error}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Payload: </span>
                        <pre className="mt-0.5 overflow-x-auto text-[10px] text-foreground/90 whitespace-pre-wrap">
                          {typeof item.payload === "string"
                            ? item.payload
                            : JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </div>
                      {item.result && (
                        <div>
                          <span className="text-muted-foreground">Result: </span>
                          <pre className="mt-0.5 overflow-x-auto text-[10px] text-emerald-400 whitespace-pre-wrap">
                            {typeof item.result === "string"
                              ? item.result
                              : JSON.stringify(item.result, null, 2)}
                          </pre>
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
