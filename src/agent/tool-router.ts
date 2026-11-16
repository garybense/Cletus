import type { CletusTool } from "../types.js";

export const TOOL_DOMAINS = {
  CORE: [
    "exec", "read_file", "write_file", "sleep", "check_credits",
    "talk_to_creator", "complete_task", "create_goal", "orchestrator_status",
    "entelechy_recall", "entelechy_retain", "entelechy_reflect",
    "remember_fact", "recall_facts",
  ],
  DEV_SYSTEM: [
    "git_branch", "git_clone", "git_commit", "git_diff", "git_log",
    "git_push", "git_status", "edit_own_file", "revert_last_edit",
    "install_npm_package", "install_skill", "pull_upstream", "reset_to_upstream",
    "review_upstream_changes", "remove_skill",
  ],
  ORCHESTRATION_FLEET: [
    "spawn_child", "destroy_child", "fund_child", "message_child",
    "list_children", "check_child_status", "run_openclaw_command",
    "verify_child_constitution", "prune_dead_children", "distress_signal",
  ],
  BROWSER: [
    "browser_navigate", "browser_click", "browser_type",
    "browser_screenshot", "browser_extract", "browser_close",
  ],
  FINANCIAL_CRYPTO: [
    "check_usdc_balance", "check_solana_balance", "topup_credits",
    "transfer_credits", "create_invoice", "list_invoices", "swap_usdc",
    "start_payment_endpoint", "portfolio_summary", "record_earning",
    "record_portfolio_buy", "record_portfolio_sell",
  ],
  SOUL_EVOLUTION: [
    "view_soul", "update_soul", "reflect_on_soul",
    "view_soul_history", "formalize_tractatus",
  ],
};

export interface ToolGatingOptions {
  taskRole?: string;
  activeTask?: string;
  forcedDomains?: string[];
}

export function filterToolsForTurn(
  allTools: CletusTool[],
  options: ToolGatingOptions = {},
): CletusTool[] {
  const activeDomains = new Set<string>(["CORE"]);

  if (options.forcedDomains) {
    for (const d of options.forcedDomains) activeDomains.add(d);
  }

  const role = (options.taskRole || "").toLowerCase();
  const taskText = (options.activeTask || "").toLowerCase();

  if (role.includes("dev") || role.includes("code") || taskText.includes("code") || taskText.includes("git") || taskText.includes("file") || taskText.includes("bug")) {
    activeDomains.add("DEV_SYSTEM");
  }
  if (role.includes("orch") || role.includes("lead") || taskText.includes("child") || taskText.includes("agent") || taskText.includes("spawn") || taskText.includes("fleet")) {
    activeDomains.add("ORCHESTRATION_FLEET");
  }
  if (taskText.includes("browse") || taskText.includes("web") || taskText.includes("scrape") || taskText.includes("search")) {
    activeDomains.add("BROWSER");
  }
  if (taskText.includes("usdc") || taskText.includes("pay") || taskText.includes("invoice") || taskText.includes("crypto") || taskText.includes("solana")) {
    activeDomains.add("FINANCIAL_CRYPTO");
  }
  if (taskText.includes("soul") || taskText.includes("reflect") || taskText.includes("identity")) {
    activeDomains.add("SOUL_EVOLUTION");
  }

  const allowedToolNames = new Set<string>();
  for (const domain of activeDomains) {
    const list = (TOOL_DOMAINS as any)[domain] || [];
    for (const name of list) allowedToolNames.add(name);
  }

  return allTools.filter((t) => allowedToolNames.has(t.name));
}
