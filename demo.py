#!/usr/bin/env python3
"""
Basic Python script to demonstrate capability.
This script prints a message and the current environment info.
"""

import os
import sys
import platform
from datetime import datetime

def main():
    print("=" * 50)
    print("Autonomous Task Environment Demo")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Python Version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Current Directory: {os.getcwd()}")
    print(f"User: {os.getenv('USER', 'unknown')}")
    print("=" * 50)
    print("Demo completed successfully!")
    print("=" * 50)

if __name__ == "__main__":
    main()