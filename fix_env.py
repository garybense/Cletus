import os

path = "/Users/user/code/Cletus/.env"
if os.path.exists(path):
    with open(path, "r") as f:
        lines = f.readlines()
    new_lines = []
    for line in lines:
        if line.startswith("TELEGRAM_BOT_TOKEN") or line.startswith("TELEGRAM_CHAT_ID"):
            new_lines.append("# " + line)
        else:
            new_lines.append(line)
    with open(path, "w") as f:
        f.writelines(new_lines)
    print("Commented out telegram env vars in .env")
