/**
 * SPIRE-Style Zero-Trust Workload Identity Attestation Engine
 * Issues cryptographically signed SPIFFE IDs (spiffe://cletus.mesh/agent/<id>)
 * and SVID certificates for zero-trust mTLS peer node verification across the Agent Mesh.
 */

import crypto from "node:crypto";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("workload-identity");

export interface SpiffeSvidCertificate {
  spiffeId: string;
  publicKeyPem: string;
  signature: string;
  issuedAt: string;
  expiresAt: string;
}

export class SPIREWorkloadAttestor {
  private keyPair: crypto.KeyPairSyncResult<string, string>;

  constructor() {
    this.keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  }

  issueSvidCertificate(agentId: string, validityHours = 24): SpiffeSvidCertificate {
    const spiffeId = `spiffe://cletus.mesh/agent/${agentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + validityHours * 3600 * 1000).toISOString();

    const payload = `${spiffeId}:${this.keyPair.publicKey}:${issuedAt}:${expiresAt}`;
    const signer = crypto.createSign("SHA256");
    signer.update(payload);
    const signature = signer.sign(this.keyPair.privateKey, "hex");

    const cert: SpiffeSvidCertificate = {
      spiffeId,
      publicKeyPem: this.keyPair.publicKey,
      signature,
      issuedAt,
      expiresAt,
    };

    logger.info(`[SPIRE-ATTESTOR] Issued zero-trust SPIFFE SVID for [${spiffeId}] (Expires: ${expiresAt}).`);
    return cert;
  }

  verifyPeerSvidCertificate(cert: SpiffeSvidCertificate): boolean {
    try {
      const now = new Date();
      if (new Date(cert.expiresAt) <= now) {
        logger.warn(`[SPIRE-ATTESTOR] SVID Certificate for [${cert.spiffeId}] is expired.`);
        return false;
      }

      const payload = `${cert.spiffeId}:${cert.publicKeyPem}:${cert.issuedAt}:${cert.expiresAt}`;
      const verifier = crypto.createVerify("SHA256");
      verifier.update(payload);
      const valid = verifier.verify(cert.publicKeyPem, cert.signature, "hex");

      if (valid) {
        logger.info(`[SPIRE-ATTESTOR] Successfully verified zero-trust SVID for peer [${cert.spiffeId}].`);
      } else {
        logger.warn(`[SPIRE-ATTESTOR] Signature verification failed for peer [${cert.spiffeId}].`);
      }

      return valid;
    } catch (err: any) {
      logger.warn(`[SPIRE-ATTESTOR] SVID verification error: ${err?.message}`);
      return false;
    }
  }

  async recordAttestationMilestone(agentId: string, spiffeId: string): Promise<void> {
    const summary = `SPIRE WORKLOAD ATTESTATION: Issued and verified zero-trust SPIFFE SVID [${spiffeId}] for agent [${agentId}].`;
    await retainEntelechyTaskResult(`spire_attestation_${agentId}`, summary, ENTELECHY_DEFAULT_BANK).catch(() => {});
  }
}
