import sys, json, time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_shodan_remote(query):
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
    
    print("[*] Connecting to 127.0.0.1:9222...")
    try:
        driver = webdriver.Chrome(options=chrome_options)
        wait = WebDriverWait(driver, 20)
        results = []

        search_url = "https://www.shodan.io/search?query=" + query
        print("[*] Navigating to: " + search_url)
        driver.get(search_url)

        page = 1
        while page <= 100:
            print(f"[*] Page {page}...")
            try:
                wait.until(EC.presence_of_element_located((By.CLASS_NAME, "search-result")))
                elements = driver.find_elements(By.CLASS_NAME, "search-result")
                for el in elements:
                    try:
                        ip = el.find_element(By.CLASS_NAME, "ip").text.strip()
                        port = el.find_element(By.CLASS_NAME, "port").text.strip()
                        results.append(ip + ":" + port)
                    except: continue
                print(f"[+] Found {len(elements)} results. Total: {len(results)}")
                
                next_btns = driver.find_elements(By.LINK_TEXT, "Next")
                if not next_btns or "disabled" in next_btns[0].get_attribute("class"):
                    print("[*] No more results.")
                    break
                
                next_btns[0].click()
                page += 1
                time.sleep(2)
            except Exception as e:
                print(f"[!] Page error: {e}")
                break
        
        return results
    except Exception as e:
        print(f"[!] Connection error: {e}")
        return []
    finally:
        print("[*] Detached.")

if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else 'product:"Ollama"'
    ips = scrape_shodan_remote(q)
    if ips:
        with open("/Users/user/code/CletusWork/ollama_ips.json", "w") as f:
            json.dump(ips, f, indent=2)
        print(f"[+] Saved {len(ips)} IPs.")
