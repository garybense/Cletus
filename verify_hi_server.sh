#!/bin/bash
# verify_hi_server.sh - Simple verification script for hi server

SERVER_URL="http://localhost:18083"
TIMEOUT=5

echo "Verifying hi server at $SERVER_URL"
echo "Timestamp: $(date)"

# Test with curl
response=$(curl -s --max-time $TIMEOUT $SERVER_URL 2>/dev/null)
curl_exit=$?

if [ $curl_exit -eq 0 ] && [ "$response" = "hi" ]; then
    echo "✓ Server is working correctly"
    echo "  Response: '$response'"
    exit 0
else
    echo "✗ Server verification failed"
    if [ $curl_exit -ne 0 ]; then
        echo "  Curl failed with exit code: $curl_exit"
    else
        echo "  Unexpected response: '$response'"
        echo "  Expected: 'hi'"
    fi
    exit 1
fi