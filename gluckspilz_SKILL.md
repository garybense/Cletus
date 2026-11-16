---
name: gluckspilz
description: Use the Gluckspilz AI Tools API (134+ specialized security and OSINT tools).
auto-activate: true
---

# Gluckspilz AI Tools API

Access a massive suite of specialized security, forensics, network, and OSINT tools hosted on the Gluckspilz remote server.

## Endpoint
`http://208.113.130.72:8899`

## Usage Instructions

1. **Check Status**: Use `curl -s http://208.113.130.72:8899/health` to see available tools and system health.
2. **Execute Tool**: Send a POST request to `/execute` with the tool name and arguments.

### Example: Running Nmap
```bash
curl -X POST http://208.113.130.72:8899/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "nmap",
    "args": ["-F", "target.com"]
  }'
```

### Available Tools (134 Total):
- **Web Security**: sqlmap, nikto, dirb, dirsearch, gobuster, zaproxy, ffuf, katana, nuclei, subfinder, arjun, byp4xx, cmseek, commix, droopescan, feroxbuster, fierce, graphql-scanner, joomscan, moodlescan, nikto, nosqlmap, paramspider, smuggler, tplmap, uro, vbulletin-scanner, wafw00f, wfuzz, wpscan, x8, xsser
- **Network**: nmap, masscan, rustscan, aircrack-ng, aireplay-ng, airmon-ng, airodump-ng, arp-scan, autorecon, dnsenum, enum4linux, enum4linux-ng, kismet, nbtscan, nxc, responder, rpcclient, smbmap, tcpdump, tshark, wireshark
- **OSINT**: sherlock, theharvester, spiderfoot, social-analyzer, censys-cli, dork-scanner, have-i-been-pwned, maltego, recon-ng, shodan-cli
- **Forensics**: volatility3, volatility, vol, binwalk, sleuthkit, autopsy, bulk-extractor, exiftool, foremost, photorec, scalpel, stegsolve, testdisk, zsteg, steghide, outguess
- **Exploitation & RE**: metasploit (msfconsole, msfvenom), exploit-db, searchsploit, angr, binaryninja, checksec, dnspy, evil-winrm, frida, gdb, gdb-peda, gef, hash-identifier, hashcat, hashcat-utils, hashpump, ilspy, jadx, john, jwt-analyzer, libc-database, linux-exploit-suggester, objdump, one-gadget, ophcrack, packetstorm-cli, patator, pwninit, pwntools, radare2, ropgadget, ropper, windows-exploit-suggester
- **Cloud & Dev**: checkov, clair, docker-bench-security, falco, kube-bench, kube-hunter, prowler, scout-suite, terrascan, trivy, curl, httpie, insomnia, postman, strings, xxd

## Constraints
- Use this server for high-intensity scanning or specialized forensic tasks.
- Always check `/health` first to ensure the tool you want is "available" (true).
- Parallelize large scans by spawning Clawbots to manage different Gluckspilz tool invocations.

