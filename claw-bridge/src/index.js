import http from 'http';
import { verifyMessage, keccak256, toBytes } from 'viem';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const PORT = 19793;
const jobQueue = [];

// Helper to verify Solana signature
function verifySolana(message, signature, address) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(address);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (e) {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Wallet-Address, X-Signature, X-Timestamp');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Cletus Sending a Message
  if (req.url === '/v1/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const contentHash = keccak256(toBytes(payload.content));
        const canonical = `Mindmods:send:${payload.to.toLowerCase()}:${contentHash}:${payload.signed_at}`;

        // Validate Signature
        let valid = false;
        if (payload.from.length > 42) { // Solana
          valid = verifySolana(canonical, payload.signature, payload.from);
        } else { // EVM
          valid = await verifyMessage({
            address: payload.from,
            message: canonical,
            signature: payload.signature,
          });
        }

        if (!valid) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid cryptographic signature' }));
          return;
        }

        // Signature is valid. Add to ClawScrap queue.
        const jobId = `job_${Date.now()}`;
        jobQueue.push({
          id: jobId,
          target: payload.to,
          content: payload.content,
          at: payload.signed_at
        });

        console.log(`[CLAWBRIDGE] Received job ${jobId} for ${payload.to}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: jobId }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. ClawScrap Polling for Jobs
  if (req.url === '/claw/poll' && req.method === 'GET') {
    const job = jobQueue.shift();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(job || { status: 'idle' }));
    return;
  }

  // 3. Cletus Polling for replies (Mocked for now)
  if (req.url === '/v1/messages/poll' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: [] }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦞 ClawBridge active at http://localhost:${PORT}`);
  console.log(`Ready to relay to ClawScrap extension.`);
});
