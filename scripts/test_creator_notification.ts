import { getDb } from "../src/state/database.js";
import { loadConfig } from "../src/config.js";

async function main() {
  console.log("[*] Testing Multi-Level Creator Notification Dispatch...");
  const botToken = "8524861084:AAFn1BK_vAQGeuP-PEFpWc5p9yyz4v9oOxM";
  const chatId = "5819616826";

  const message = "Gary — Multi-Level Creator Notification System initialized! Direct Telegram delivery active with importance levels (Low, Medium, High, Critical).";
  const importance = "high";
  const prefix = "⚠️ [Cletus - High Priority Notification]";

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `${prefix}\n\n${message}`,
    }),
  });

  if (resp.ok) {
    console.log("[+] SUCCESS: Telegram Notification Delivered Directly to Creator Chat!");
  } else {
    console.log("[-] Telegram error:", await resp.text());
  }
}

main().catch(console.error);
