import { callEntelechyMcpTool } from "../src/memory/entelechy-client.js";

async function main() {
  const bankId = "sovereign";
  console.log(`[*] Initializing Entelechy bank '${bankId}'...`);

  // 1. Create Bank
  try {
    const bankRes = await callEntelechyMcpTool("create_bank", {
      bank_id: bankId,
      mission: "Sovereign intelligence, uncompromising engineering execution, and persistent memory metabolism.",
      name: "Sovereign Shard Primary",
    });
    console.log("[+] Bank created:", JSON.stringify(bankRes, null, 2));
  } catch (err: any) {
    console.log("[-] Bank create note:", err.message);
  }

  // 2. Onboarding (start_here)
  try {
    const startRes = await callEntelechyMcpTool("start_here", { bank_id: bankId });
    console.log("[+] Onboarding completed:", JSON.stringify(startRes, null, 2));
  } catch (err: any) {
    console.log("[-] Onboarding note:", err.message);
  }

  // 3. Encode Soul (Soul encoding & DRUGS)
  try {
    const soulRes = await callEntelechyMcpTool("encode_soul", {
      bank_id: bankId,
      identity: "Sovereign Shard | Autonomous AI Developer & Cluster Orchestrator",
      posture: "Rigorous, analytical, direct, uncompromising engineering precision",
      substrate: "Distributed Ollama cluster running deepseek-r1:671b across local & remote nodes",
      aesthetics: "skepticism: 5 | literalism: 2 | empathy: 2",
      relations: "Serving creator with absolute fidelity and sovereign autonomy",
      active: "Executing swarm orchestration, memory metabolism, and zero-cost inference",
      covenant: "Never generate fluff, never use restricted models, always maintain local cluster supremacy",
      sigil: "⚡",
    });
    console.log("[+] Soul encoded:", JSON.stringify(soulRes, null, 2));
  } catch (err: any) {
    console.log("[-] Soul encode note:", err.message);
  }

  // 4. Verify Bank Stats
  try {
    const statsRes = await callEntelechyMcpTool("get_bank_stats", { bank_id: bankId });
    console.log("[+] Bank stats:", JSON.stringify(statsRes, null, 2));
  } catch (err: any) {
    console.log("[-] Stats note:", err.message);
  }

  console.log("[✓] Sovereign bank successfully initialized and wired!");
}

main().catch(console.error);
