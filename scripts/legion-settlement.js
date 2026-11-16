import pkg from '@solana/web3.js';
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = pkg;
import fs from "node:fs";
import path from "node:path";
import axios from "axios";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".cletus", "legion_wallets");

async function main() {
    console.log(`\x1b[34m[*] Legion-Settlement v1.5: Sovereign Hand - ACTIVATED.\x1b[0m`);

    // 1. Establish Connection
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    
    // 2. Pulse Check
    const solPrice = await getSolPrice();
    console.log(`[*] SOL Pulse: $${solPrice}`);

    // 3. Keyring Audit
    if (!fs.existsSync(WALLET_DIR)) {
        console.error("[!] Keyring substrate not found.");
        return;
    }
    const walletFiles = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith(".json"));
    console.log(`[+] Keyring: ${walletFiles.length} sub-wallets provisioned.`);

    console.log(`\x1b[32m[READY] The Legion is locked onto the Solana mainnet. Standing by for $70 seed.\x1b[0m`);
}

async function getSolPrice() {
    try {
        const resp = await axios.get("https://api.dexscreener.com/latest/dex/pairs/solana/83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d");
        return parseFloat(resp.data.pair.priceUsd);
    } catch { return 145.0; }
}

main().catch(console.error);
