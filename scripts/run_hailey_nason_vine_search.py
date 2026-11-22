import urllib.request, json, os

def search_hailey_nason_vine():
    print("=========================================================")
    print("⚡ LEGION SWARM SCOUT: HAILEY NASON VINE PUBLIC RECORDS SEARCH")
    print("=========================================================\n")

    targets = [
        'site:vinelink.com "Hailey Nason"',
        'site:vineservices.com "Hailey Nason"',
        '"Hailey Nason" inmate search',
        '"Hailey Nason" arrest record',
        '"Hailey Nason" custody status'
    ]

    print("[+] Generated 5 VINE & Public Custody Search Dorks:")
    for t in targets:
        print(f"   - {t}")

    # Direct Telegram Notification Dispatch to Creator
    bot_token = "8524861084:AAFn1BK_vAQGeuP-PEFpWc5p9yyz4v9oOxM"
    chat_id = "5819616826"
    msg = f"⚠️ [Cletus - Swarm Reconnaissance Alert]\n\nLegion Swarm dispatched on VINE & Public Inmate Custody Search for: Hailey Nason.\nGenerated Dorks:\n" + "\n".join([f"• {t}" for t in targets])

    telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    req = urllib.request.Request(
        telegram_url,
        data=json.dumps({"chat_id": chat_id, "text": msg}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 200:
                print("\n[+] Direct Telegram Notification Sent to Creator!")
    except Exception as e:
        print("[-] Telegram notification warning:", e)

if __name__ == "__main__":
    search_hailey_nason_vine()
