#!/usr/bin/env python3
"""
arXiv & GitHub Multi-Agent Systems Research Harvester
Executed by Swarm when self-evolution cycle requires new frontier ideas.
Queries arXiv for cs.MA multiagent papers and GitHub for advanced agentic frameworks.
Outputs ~/Downloads/Swarm_arXiv_GitHub_Research_Report.md and retains to Entelechy bank 'cletus'.
"""

import urllib.request
import xml.etree.ElementTree as ET
import json
import os
import datetime

HEADERS = {"User-Agent": "Cletus-Swarm-Research-Harvester/1.0"}

def harvest_arxiv_multiagent():
    print("[*] Swarm: Querying arXiv for latest cs.MA multi-agent systems research...")
    url = "http://export.arxiv.org/api/query?search_query=cat:cs.MA+OR+all:multiagent+systems&sortBy=submittedDate&sortOrder=descending&max_results=5"
    papers = []
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        xml_data = urllib.request.urlopen(req, timeout=10).read()
        root = ET.fromstring(xml_data)
        
        for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
            title = entry.find("{http://www.w3.org/2005/Atom}title").text.strip().replace("\n", " ")
            summary = entry.find("{http://www.w3.org/2005/Atom}summary").text.strip().replace("\n", " ")
            link = entry.find("{http://www.w3.org/2005/Atom}id").text.strip()
            published = entry.find("{http://www.w3.org/2005/Atom}published").text.strip()
            papers.append({"title": title, "summary": summary[:300] + "...", "link": link, "published": published})
    except Exception as e:
        print(f"arXiv Query Error: {e}")
    return papers

def harvest_github_multiagent():
    print("[*] Swarm: Querying GitHub for advanced multi-agent systems repositories...")
    url = "https://api.github.com/search/repositories?q=multiagent+OR+multi-agent+systems+language:python&sort=stars&order=desc&per_page=5"
    repos = []
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        data = json.loads(urllib.request.urlopen(req, timeout=10).read().decode())
        for item in data.get("items", []):
            repos.append({
                "name": item.get("full_name"),
                "description": item.get("description"),
                "stars": item.get("stargazers_count"),
                "url": item.get("html_url")
            })
    except Exception as e:
        print(f"GitHub Query Error: {e}")
    return repos

def run_research_pipeline():
    papers = harvest_arxiv_multiagent()
    repos = harvest_github_multiagent()

    out_md = os.path.expanduser("~/Downloads/Swarm_arXiv_GitHub_Research_Report.md")
    
    report = f"""# Swarm Frontier Research Report: Multi-Agent Systems & Advanced Swarms
## Generated Autonomously by Cletus & Legion Swarm [{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]

### 📚 arXiv Multi-Agent Papers (cs.MA)
"""
    for p in papers:
        report += f"\n#### [{p['title']}]({p['link']})\n- **Published**: {p['published']}\n- **Abstract**: {p['summary']}\n"

    report += "\n---\n\n### 🐙 GitHub Advanced Multi-Agent Repositories\n"
    for r in repos:
        report += f"\n#### [{r['name']}]({r['url']}) (⭐ {r['stars']:,})\n- **Description**: {r['description']}\n"

    with open(out_md, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"[+] Successfully exported Swarm Research Report to {out_md}")

if __name__ == "__main__":
    run_research_pipeline()
