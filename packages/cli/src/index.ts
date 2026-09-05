#!/usr/bin/env node
/**
 * Mindmods Cletus CLI
 *
 * Creator-facing CLI for interacting with an cletus.
 * Usage: cletus-cli <command> [args]
 */

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case "status":
      await import("./commands/status.js");
      break;
    case "logs":
      await import("./commands/logs.js");
      break;
    case "fund":
      await import("./commands/fund.js");
      break;
    case "send":
      await import("./commands/send.js");
      break;
    default:
      console.log(`
Mindmods Cletus CLI - Creator Tools

Usage:
  cletus-cli status              Show cletus status
  cletus-cli logs [--tail N]     View cletus logs
  cletus-cli fund <amount> [--to 0x...]  Transfer Mindmods credits
  cletus-cli send <to-address> <message> Send a social message
`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
