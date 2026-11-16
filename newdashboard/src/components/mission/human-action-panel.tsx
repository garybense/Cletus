import { useState } from "react";
import { ExternalLink, CheckCircle2, ShieldAlert, UserCheck, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useHomestead } from "@/lib/cletus/store";
import { controlTaskGraphServer, enqueueWorkItemServer } from "@/lib/cletus/server";

function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s"'<>\)]+)/gi);
  if (!matches) return [];
  return Array.from(new Set(matches.map((url) => url.replace(/[\.,;\)]+$/, ""))));
}

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

export function HumanActionPanel() {
  const tasks = useHomestead((s) => s.tasks) || [];
  const goals = useHomestead((s) => s.goals) || [];
  const updateFromReal = useHomestead((s) => s.updateFromReal);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Collect all URLs present across tasks and goals
  const allText = [
    ...tasks.map((t) => `${t.title || ""} ${t.detail || ""}`),
    ...goals.map((g) => `${g.title || ""} ${g.detail || ""}`),
  ].join(" ");
  const activeUrls = extractUrls(allText);

  // Identify tasks requiring human intervention
  const humanTasks = tasks.filter((t) => {
    const text = `${t.title || ""} ${t.detail || ""}`.toLowerCase();
    const isInterventionStatus = t.status === "pending" || t.status === "assigned";
    const hasUrl = extractUrls(text).length > 0;
    const isManualKeyword =
      text.includes("kyc") ||
      text.includes("verification") ||
      text.includes("captcha") ||
      text.includes("account creation") ||
      text.includes("manual") ||
      text.includes("bank") ||
      text.includes("credential") ||
      text.includes("login") ||
      text.includes("human") ||
      text.includes("approval");
    return (isInterventionStatus && (isManualKeyword || hasUrl)) || text.includes("human");
  });

  const handleResolveTask = async (taskId: string, title: string) => {
    setLoadingId(taskId);
    try {
      // 1. Mark task completed in task graph
      await controlTaskGraphServer({
        data: {
          id: taskId,
          action: "complete",
        },
      });

      // 2. Enqueue wake notification to Cletus
      await enqueueWorkItemServer({
        data: {
          source: "human_operator",
          priority: 90,
          acceptancePredicate: "result.success === true",
          spendBearing: false,
          payloadStr: JSON.stringify({
            task: "human_action_completed",
            resolvedTaskId: taskId,
            taskTitle: title,
            message: "Human operator completed manual intervention prerequisite. Resuming swarm.",
          }),
        },
      });

      updateFromReal();
    } catch (err) {
      console.error("Failed to unblock task:", err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-950/20 shadow-lg backdrop-blur-sm">
      <CardHeader className="py-3.5 px-4 flex flex-row items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-amber-200">
              Operational Boundaries & Human Actions Required
            </CardTitle>
            <p className="text-xs text-amber-400/80">
              Prerequisites & tasks requiring human-in-the-loop completion (account setup, KYC, CAPTCHAs, credentials)
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs">
          Human-in-the-Loop Active
        </Badge>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Universal Guidance Banner */}
        <div className="rounded-lg border border-amber-500/30 bg-background/60 p-3.5 flex flex-col gap-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-amber-300">
            <span className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-400" />
              General Operational Boundaries
            </span>

            {/* Dynamic Direct Action Links */}
            {activeUrls.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Target Portals:
                </span>
                {activeUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-amber-300 hover:text-amber-100 hover:bg-amber-500/30 font-semibold border border-amber-500/30 transition-colors"
                  >
                    {extractDomain(url)} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
            <div className="rounded bg-black/40 p-2 border border-border/50">
              <span className="font-semibold text-foreground block mb-0.5">🤖 Swarm Capability (Automated)</span>
              Strategy planning, code generation, data synthesis, prompt design, content scheduling, and local/on-chain tasks.
            </div>
            <div className="rounded bg-black/40 p-2 border border-border/50">
              <span className="font-semibold text-amber-200 block mb-0.5">👤 Human Prerequisite (Manual Required)</span>
              External 3rd-party account creation, 2FA/CAPTCHA solving, identity/KYC verification, and payout account authorization.
            </div>
          </div>
        </div>

        {/* Dynamic Pending Interventions */}
        {humanTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
              Pending Intervention Queue ({humanTasks.length})
            </span>
            {humanTasks.map((t) => {
              const taskText = `${t.title || ""} ${t.detail || ""}`;
              const taskUrls = extractUrls(taskText);

              return (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-950/30 p-3 text-xs"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-amber-400/50 text-amber-300">
                        {t.status}
                      </Badge>
                      <span className="font-semibold text-foreground truncate">{t.title}</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-2">
                      {t.detail || "Manual operator input needed to proceed with this swarm task."}
                    </p>

                    {/* Task-Specific Extracted Direct Links */}
                    {taskUrls.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {taskUrls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-200 underline font-semibold text-[11px]"
                          >
                            Open {extractDomain(url)} <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={loadingId === t.id}
                    onClick={() => handleResolveTask(t.id, t.title)}
                    className="bg-amber-600 hover:bg-amber-500 text-black font-semibold shrink-0 gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {loadingId === t.id ? "Unblocking..." : "Mark Done & Resume Swarm"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
