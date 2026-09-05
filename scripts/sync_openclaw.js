import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_FILE = path.join(process.env.HOME, '.cletus', 'openclaw_status.json');

function sync() {
    exec(`ssh mindmods "python3 /tmp/query_openclaw.py"`, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
        if (err) {
            console.error("Error syncing openclaw:", err);
            return;
        }
        try {
            // Find JSON line at the end
            const lines = stdout.trim().split('\n');
            let jsonLine = lines[lines.length - 1];
            const data = JSON.parse(jsonLine);
            fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));
            console.log("Synced OpenClaw data at", new Date().toISOString());
        } catch (e) {
            console.error("Parse error:", e, stdout);
        }
    });
}

// Run immediately, then every 10 seconds
sync();
setInterval(sync, 10000);
