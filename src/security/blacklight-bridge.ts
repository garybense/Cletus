/**
 * Blacklight Security Auditor & Port Boundary Bridge
 *
 * Inspired by HackingTool security auditing modules.
 * Scans local and cluster endpoints for open debug ports, unauthorized bindings,
 * and vulnerability exposures.
 */

import http from "http";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("security.blacklight-bridge");

export interface PortAuditReport {
  port: number;
  open: boolean;
  service?: string;
}

export class BlacklightSecurityAuditor {
  /**
   * Audit a list of local ports for exposure or open debug interfaces.
   */
  static async auditPorts(ports: number[]): Promise<PortAuditReport[]> {
    const results: PortAuditReport[] = [];

    for (const port of ports) {
      const open = await this.checkPort(port);
      results.push({
        port,
        open,
        service: open ? `Port ${port} active` : "Closed",
      });
      if (open) {
        logger.info(`Blacklight Security Audit: Port ${port} is active`);
      }
    }

    return results;
  }

  private static checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 1000 }, (res) => {
        resolve(true);
        req.destroy();
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}
