# 1. Create local bin directory for scripts
mkdir -p ~/bin

# 2. Create a sample script to prove it works
cat << 'EOF' > ~/bin/hello-world
#!/bin/bash
echo "🚀 Custom shell command working! Hello from ~/bin."
EOF
chmod +x ~/bin/hello-world

# 3. Detect shell config file
if [ -n "$ZSH_VERSION" ]; then
    CONF="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    CONF="$HOME/.bashrc"
else
    CONF="$HOME/.profile"
fi

echo "[*] Using config file: $CONF"

# 4. Add ~/bin to PATH if not already there
if ! grep -q 'export PATH="$HOME/bin:$PATH"' "$CONF"; then
    echo 'export PATH="$HOME/bin:$PATH"' >> "$CONF"
    echo "[+] Added ~/bin to PATH in $CONF"
fi

# 5. Add a sample alias (e.g., 'lsa' for 'ls -la')
if ! grep -q "alias lsa=" "$CONF"; then
    echo "alias lsa='ls -la'" >> "$CONF"
    echo "[+] Added alias 'lsa' to $CONF"
fi

# 6. Apply changes immediately to current session
export PATH="$HOME/bin:$PATH"
[[ -f "$CONF" ]] && source "$CONF"

echo "--------------------------------------------------"
echo "✅ DONE! You can now use:"
echo "   1. 'hello-world' -> runs your new script"
echo "   2. 'lsa'         -> runs 'ls -la'"
echo "--------------------------------------------------"

