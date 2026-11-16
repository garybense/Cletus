import requests
import json
import time

def get_latest_headlines():
    # Simplified search for latest crypto news headlines
    url = "https://news.google.com/rss/search?q=solana+crypto+news&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = requests.get(url, timeout=10)
        # Fast extraction of titles from RSS
        titles = re.findall(r'<title>(.*?)</title>', resp.text)
        return [t for t in titles if "Google" not in t][:5]
    except: return []

if __name__ == "__main__":
    import re
    print("[*] Aethel: Siphoning latest news for the Legion...")
    headlines = get_latest_headlines()
    for h in headlines:
        print(f"[HEADLINE]: {h}")
