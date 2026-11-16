import sys, json, time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_shodan(u, p, q):
    o = Options()
    o.add_argument("--headless")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-dev-shm-usage")
    d = webdriver.Chrome(options=o)
    w = WebDriverWait(d, 20)
    res = []
    try:
        print("[*] Logging in...")
        d.get("https://www.shodan.io/login")
        w.until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(u)
        d.find_element(By.NAME, "password").send_keys(p)
        d.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        w.until(EC.presence_of_element_located((By.CLASS_NAME, "account")))
        print("[+] Login OK.")
        d.get("https://www.shodan.io/search?query=" + q)
        page = 1
        while page <= 50:
            print(f"[*] Page {page}...")
            w.until(EC.presence_of_element_located((By.CLASS_NAME, "search-result")))
            els = d.find_elements(By.CLASS_NAME, "search-result")
            for el in els:
                try:
                    ip = el.find_element(By.CLASS_NAME, "ip").text.strip()
                    port = el.find_element(By.CLASS_NAME, "port").text.strip()
                    res.append(ip + ":" + port)
                except: continue
            print(f"[+] Found {len(els)} results.")
            try:
                nxt = d.find_element(By.LINK_TEXT, "Next")
                if "disabled" in nxt.get_attribute("class"): break
                nxt.click()
                page += 1
                time.sleep(2)
            except: break
    except Exception as e: print(f"Error: {e}")
    finally: d.quit()
    return res

if __name__ == "__main__":
    ips = scrape_shodan(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'product:"Ollama"')
    with open("/home/debian/ollama_ips.json", "w") as f: json.dump(ips, f, indent=2)
    print(f"Total: {len(ips)}")
