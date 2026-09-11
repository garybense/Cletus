#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║  ██╗  ██╗ █████╗ ██╗      █████╗ ██████╗ ██╗     ██████╗ ██████╗ ██████╗ ║
║  ██║  ██║██╔══██╗██║     ██╔══██╗██╔══██╗██║     ██╔═══██╗██╔══██╗██╔══██╗ ║
║  ███████║███████║██║     ███████║██████╔╝██║     ██║   ██║██████╔╝██████╔╝ ║
║  ██╔══██║██╔══██║██║     ██╔══██║██╔══██╗██║     ██║   ██║██╔══██╗██╔══██╗ ║
║  ██║  ██║██║  ██║███████╗██║  ██║██████╔╝███████╗╚██████╔╝██████╔╝██████╔╝ ║
║  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ║
║                                                                              ║
║  ████████╗███████╗██████╗ ██████╗ ███████╗    ████████╗███╗   ██╗███████╗ ║
║  ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝    ╚══██╔══╝████╗  ██║██╔════╝ ║
║     ██║   █████╗  ██████╔╝██████╔╝█████╗         ██║   ██╔██╗ ██║█████╗   ║
║     ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══╝         ██║   ██║╚██╗██║██╔══╝   ║
║     ██║   ███████╗██║  ██║██████╔╝███████╗       ██║   ██║ ╚████║███████╗ ║
║     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝       ╚═╝   ╚═╝  ╚═══╝ ╚══════╝ ║
║                                                                              ║
║  ╔══════════════════════════════════════════════════════════════════════╗  ║
║  ║          Elite ANSI Terminal API Key Scanner & Tester                ║  ║
║  ║          ───────────────────────────────────────────────────────────  ║  ║
║  ║  • Mind-Blowingly Colorful Output                                  ║  ║
║  ║  • All Auth Styles (Bearer, xi-api-key, X-API-Key, Basic, Query)  ║  ║
║  ║  • Scan Your Entire Drive                                          ║  ║
║  ║  • Test Each Key Live                                              ║  ║
║  ║  • Super Stylized Results                                          ║  ║
║  ╚══════════════════════════════════════════════════════════════════════╝  ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import re
import time
import argparse
import threading
import requests
import functools
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Callable, Any
from copy import deepcopy

# Module-level progress tracking (accessible by progress reporter thread)
_progress_active = False
_files_scanned = 0
_current_path = ""
_progress_lock = threading.Lock()
_key_found_blink = 0
_last_key_found = ("", "", "")
_collected_keys_buffer = []
last_progress_display = ""

# ═══════════════════════════════════════════════════════════════════════════
#  COLORS - MODERN ANSI WITH BLINK, BOLD, UNDERLINE, BACKGROUND COLORS
# ═══════════════════════════════════════════════════════════════════════════
class ANSI:
    # 8 standard colors
    BLACK      = '\033[0;30m'
    RED        = '\033[0;31m'
    GREEN      = '\033[0;32m'
    BROWN      = '\033[0;33m'
    BLUE       = '\033[0;34m'
    MAGENTA    = '\033[0;35m'
    CYAN       = '\033[0;36m'
    LIGHT_GRAY = '\033[0;37m'
    
    # Bright/Bold variants
    DARK_GRAY  = '\033[1;30m'
    BRIGHT_RED = '\033[1;31m'
    BRIGHT_GREEN = '\033[1;32m'
    YELLOW     = '\033[1;33m'
    BRIGHT_BLUE = '\033[1;34m'
    BRIGHT_MAGENTA = '\033[1;35m'
    BRIGHT_CYAN = '\033[1;36m'
    WHITE      = '\033[1;37m'
    BRIGHT_WHITE = '\033[1;97m'
    
    # Background colors
    BG_BLACK      = '\033[40m'
    BG_RED        = '\033[41m'
    BG_GREEN      = '\033[42m'
    BG_YELLOW     = '\033[43m'
    BG_BLUE       = '\033[44m'
    BG_MAGENTA    = '\033[45m'
    BG_CYAN       = '\033[46m'
    BG_LIGHT_GRAY = '\033[47m'
    
    # Extended background colors
    BG_DARK_GRAY     = '\033[100m'
    BG_BRIGHT_RED    = '\033[101m'
    BG_BRIGHT_GREEN  = '\033[102m'
    BG_BRIGHT_YELLOW = '\033[103m'
    BRIGHT_YELLOW = '\033[1;33m'
    BG_BRIGHT_BLUE   = '\033[104m'
    BG_BRIGHT_MAGENTA = '\033[105m'
    BG_BRIGHT_CYAN   = '\033[106m'
    BG_WHITE         = '\033[107m'
    
    # Effects
    BOLD       = '\033[1m'
    UNDERLINE  = '\033[4m'
    BLINK      = '\033[5m'
    REVERSE    = '\033[7m'
    INVISIBLE  = '\033[8m'
    RESET      = '\033[0m'
    
    # 256 color support
    def fg256(self, n: int) -> str:
        return f'\033[38;5;{n}m'
    
    def bg256(self, n: int) -> str:
        return f'\033[48;5;{n}m'
    
    # True color / RGB
    def fg_rgb(self, r: int, g: int, b: int) -> str:
        return f'\033[38;2;{r};{g};{b}m'
    
    def bg_rgb(self, r: int, g: int, b: int) -> str:
        return f'\033[48;2;{r};{g};{b}m'
    
    # Pre-made insane color combos
    NEON_PINK      = '\033[1;38;5;200m'
    NEON_GREEN     = '\033[1;38;5;46m'
    NEON_BLUE      = '\033[1;38;5;39m'
    NEON_PURPLE    = '\033[1;38;5;129m'
    CYBER_YELLOW   = '\033[1;38;5;226m'
    CHROME_SILVER  = '\033[1;38;5;244m'
    MATRIX_GREEN   = '\033[1;38;5;28m'
    ELECTRIC_BLUE = '\033[1;38;5;75m'
    HOT_PINK       = '\033[1;38;5;198m'
    GOLD           = '\033[1;38;5;178m'
    ORANGE         = '\033[1;38;5;208m'
    TEAL           = '\033[1;38;5;44m'
    
    # Gradient-ish presets for headers
    def rainbow_text(self, text: str) -> str:
        colors = [
            self.NEON_PINK, self.ORANGE, self.YELLOW,
            self.NEON_GREEN, self.TEAL, self.NEON_BLUE,
            self.NEON_PURPLE, self.HOT_PINK
        ]
        result = []
        for i, char in enumerate(text):
            result.append(f"{colors[i % len(colors)]}{char}")
        return ''.join(result) + self.RESET
    
    def visible_length(self, text: str) -> int:
        """Calculate visible length ignoring ANSI escape codes."""
        ansi_escape = re.compile(r'\x1b\[[0-9;]*m')
        return len(ansi_escape.sub('', text))
    
    def gradient_text(self, text: str, start_color: tuple, end_color: tuple) -> str:
        """Apply a gradient from start_color to end_color across the text."""
        r1, g1, b1 = start_color
        r2, g2, b2 = end_color
        n = len(text)
        result = []
        for i, char in enumerate(text):
            t = i / max(n - 1, 1)
            r = int(r1 + (r2 - r1) * t)
            g = int(g1 + (g2 - g1) * t)
            b = int(b1 + (b2 - b1) * t)
            result.append(f"{self.fg_rgb(r, g, b)}{char}")
        return ''.join(result) + self.RESET
    
    def cyber_title(self, text: str, title_len: int = 80, gradient: bool = True) -> str:
        """Create a cyberpunk-style title with border and gradient."""
        inner_len = title_len - 4  # space for ║ on each side
        
        # Gradient border top
        border_colors = [
            (self.ELECTRIC_BLUE, self.fg_rgb(50, 180, 255)),
            (self.NEON_PURPLE, self.HOT_PINK),
        ]
        
        border_top_ansi = self.gradient_text('╔' + '═' * (title_len - 2) + '╗', 
                                               (50, 180, 255), (255, 100, 200))
        border_bot_ansi = self.gradient_text('╚' + '═' * (title_len - 2) + '╝',
                                               (255, 100, 200), (50, 180, 255))
        
        # Center the text within the box
        text_with_spaces = f" {text} "
        text_visible_len = len(text_with_spaces)
        left_padding = (inner_len - text_visible_len) // 2
        
        # Build the line with proper visible-width padding
        line = f"{self.ELECTRIC_BLUE}║{self.RESET}"
        line += " " * max(0, left_padding)
        
        if gradient:
            line += self.gradient_text(text_with_spaces, (0, 255, 200), (255, 150, 0))
        else:
            line += f"{self.fg_rgb(100, 200, 255)}{text_with_spaces}"
        
        # Calculate padding by visible length
        current_visible = len(line) - line.count('\x1b')
        pad_needed = inner_len - left_padding - text_visible_len
        line += " " * max(0, pad_needed)
        line += f"{self.ELECTRIC_BLUE}║{self.RESET}"
        
        return f"{border_top_ansi}\n{line}\n{border_bot_ansi}"

    def glitch_text(self, text: str, intensity: int = 3) -> str:
        """Add glitch/scanline effect to text"""
        glitch_chars = ['█', '▓', '▒', '░', '▄', '▀', '▌', '▐']
        result = []
        for i, char in enumerate(text):
            if i % (intensity + 1) == 0 and char != ' ':
                glitch = glitch_chars[i % len(glitch_chars)]
                result.append(f"{self.BRIGHT_RED if i % 2 else self.BRIGHT_GREEN}{glitch}")
            else:
                result.append(char)
        return ''.join(result) + self.RESET


# ═══════════════════════════════════════════════════════════════════════════
#  KEY PATTERNS - ALL THE KEY TYPES WE CAN FIND
# ═══════════════════════════════════════════════════════════════════════════
KEY_PATTERNS: List[Tuple[str, str]] = [
    # ═══════════════════════════════════════════════════════════════════════
    #  OpenAI Ecosystem
    # ═══════════════════════════════════════════════════════════════════════
    (r'sk-[0-9a-zA-Z\-_]{20,}', 'OpenAI API Key'),
    (r'openai[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'OpenAI Key'),
    (r'OPENAI_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'OpenAI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Anthropic / Claude
    # ═══════════════════════════════════════════════════════════════════════
    (r'anthropic[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Anthropic Key'),
    (r'ANTHROPIC_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Anthropic Env Var'),
    (r'ANTHROPIC_[A-Z_]+=\S+', 'Anthropic Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  xAI / Grok
    # ═══════════════════════════════════════════════════════════════════════
    (r'xai[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'XAI/Grok Key'),
    (r'XAI_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'XAI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  ElevenLabs
    # ═══════════════════════════════════════════════════════════════════════
    (r'elevenlabs[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'ElevenLabs Key'),
    (r'ELEVENLABS_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'ElevenLabs Env Var'),
    (r'xi-api-key["\']?\s*[=:]\s*["\']?([a-zA-Z0-9\-_]{20,})', 'ElevenLabs xi-api-key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Google Ecosystem
    # ═══════════════════════════════════════════════════════════════════════
    (r'AIza[0-9A-Za-z\-_]{35}', 'Google API Key (format)'),
    (r'google[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{30,})', 'Google API Key'),
    (r'google[_-]?cloud[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Google Cloud Key'),
    (r'GOOGLE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Google API Env Var'),
    (r'GOOGLE_CLOUD_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Google Cloud API Env Var'),
    (r'GOOGLE_[A-Z_]+=\S+', 'GCloud Env Var'),
    (r'GOOGLE_APPLICATION_CREDENTIALS\s*[=:]?\s*["\'](.+)["\']?', 'Google App Creds Path'),
    (r'google[_-]?application\s*[_-]?credentials\s*[=:]?\s*["\'](.+)["\']?', 'Google App Creds'),
    (r'vertex[_-]?ai[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Vertex AI Key'),
    (r'VERTEX_AI_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Vertex AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  NVIDIA
    # ═══════════════════════════════════════════════════════════════════════
    (r'nvapi-[0-9a-zA-Z\-_]+', 'NVIDIA API Key'),
    (r'nvidia[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'NVIDIA Key'),
    (r'NVIDIA_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'NVIDIA Env Var'),
    (r'NVIDIA_[A-Z_]+=\S+', 'NVIDIA Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  OpenRouter
    # ═══════════════════════════════════════════════════════════════════════
    (r'sk-or-v1-[0-9a-zA-Z\-_]+', 'OpenRouter API Key'),
    (r'openrouter[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'OpenRouter Key'),
    (r'OPENROUTER_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'OpenRouter Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  DeepSeek
    # ═══════════════════════════════════════════════════════════════════════
    (r'deepseek[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'DeepSeek Key'),
    (r'DEEPSEEK_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'DeepSeek Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  AWS
    # ═══════════════════════════════════════════════════════════════════════
    (r'AWS[_-]?ACCESS[_-]?KEY[_-]?ID\s*[=:]?\s*["\']([A-Z0-9]{20})["\']?', 'AWS Access Key'),
    # AWS Access Key IDs are 20 chars, start with AKIA, ASIA, or ABIA
    # Be very restrictive to avoid matching function names like 'marshalNegativeUint'
    (r'\b(AKIA|ASIA|ABIA)[A-Z0-9]{16}\b', 'AWS Access Key ID'),
    (r'AWS[_-]?SECRET[_-]?ACCESS[_-]?KEY\s*[=:]?\s*["\']([A-Za-z0-9/+=]{40})["\']?', 'AWS Secret Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Stripe
    # ═══════════════════════════════════════════════════════════════════════
    (r'sk_live_[0-9a-zA-Z]{24,}', 'Stripe Live Key'),
    (r'sk_test_[0-9a-zA-Z]{24,}', 'Stripe Test Key'),
    (r'pk_live_[0-9a-zA-Z]{24,}', 'Stripe Publishable Live'),
    (r'pk_test_[0-9a-zA-Z]{24,}', 'Stripe Publishable Test'),
    (r'stripe[_-]?api[_-]?key\s*[=:]?\s*["\']?([sk|rk]_[a-z]+_[0-9a-zA-Z]+)', 'Stripe Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  GitHub
    # ═══════════════════════════════════════════════════════════════════════
    (r'ghp_[0-9a-zA-Z]{36}', 'GitHub Personal Token'),
    (r'gho_[0-9a-zA-Z]{36}', 'GitHub OAuth Token'),
    (r'ghu_[0-9a-zA-Z]{36}', 'GitHub User Token'),
    (r'ghs_[0-9a-zA-Z]{36}', 'GitHub Server Token'),
    (r'ghr_[0-9a-zA-Z]{36}', 'GitHub Refresh Token'),
    (r'github[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9]{20,})', 'GitHub Token'),
    (r'GITHUB_TOKEN\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'GitHub Token Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  GitLab
    # ═══════════════════════════════════════════════════════════════════════
    (r'glpat-[0-9a-zA-Z\-]{20,}', 'GitLab Personal Access Token'),
    (r'gitlab[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'GitLab Token'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Slack
    # ═══════════════════════════════════════════════════════════════════════
    (r'xox[baprs]-[0-9a-zA-Z\-]{20,}', 'Slack Token'),
    (r'slack[_-]?bot[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Slack Bot Token'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Twilio
    # ═══════════════════════════════════════════════════════════════════════
    # TWilio SIDs are 32 hex chars starting with AC - but filter test data
    (r'\bAC[0-9a-fA-F]{32}\b', 'Twilio Account SID'),
    (r'\bAP[0-9a-fA-F]{32}\b', 'Twilio API Key'),
    (r'twilio[_-]?auth[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Twilio Auth Token'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  SendGrid
    # ═══════════════════════════════════════════════════════════════════════
    (r'sg_[0-9a-zA-Z\-]{20,}', 'SendGrid API Key'),
    (r'sendgrid[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'SendGrid Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Mailgun
    # ═══════════════════════════════════════════════════════════════════════
    (r'mailgun[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Mailgun Key'),
    (r'key-[0-9a-zA-Z\-]{20,}', 'Mailgun Key (format)'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Microsoft / Azure
    # ═══════════════════════════════════════════════════════════════════════
    (r'azure[_-]?subscription[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Azure Key'),
    (r'AZURE_[A-Z_]+=\S+', 'Azure Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Mapbox
    # ═══════════════════════════════════════════════════════════════════════
    (r'mapbox[_-]?access[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Mapbox Token'),
    (r'mpk[0-9]+\.[0-9a-zA-Z\-]+', 'Mapbox Public Token'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Hugging Face
    # ═══════════════════════════════════════════════════════════════════════
    (r'huggingface[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'HuggingFace Token'),
    (r'hf_[0-9a-zA-Z\-]{20,}', 'HuggingFace Token (format)'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Groq
    # ═══════════════════════════════════════════════════════════════════════
    (r'groq[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Groq Key'),
    (r'GROQ_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Groq Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Together AI
    # ═══════════════════════════════════════════════════════════════════════
    (r'together[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Together AI Key'),
    (r'TOGETHER_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Together AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Perplexity
    # ═══════════════════════════════════════════════════════════════════════
    (r'perplexity[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Perplexity Key'),
    (r'PPLX_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Perplexity Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Fireworks AI
    # ═══════════════════════════════════════════════════════════════════════
    (r'fireworks[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Fireworks AI Key'),
    (r'FIREWORKS_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Fireworks AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Replicate
    # ═══════════════════════════════════════════════════════════════════════
    (r'replicate[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Replicate Key'),
    (r'REPLICATE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Replicate Env Var'),
    (r'replicate[_-]?api[_-]?token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Replicate Token'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Modal
    # ═══════════════════════════════════════════════════════════════════════
    (r'MODAL_TOKEN_ID\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Modal Token ID'),
    (r'MODAL_TOKEN_SECRET\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Modal Token Secret'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  RunPod
    # ═══════════════════════════════════════════════════════════════════════
    (r'runpod[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'RunPod Key'),
    (r'RUNPOD_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'RunPod Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Baseten
    # ═══════════════════════════════════════════════════════════════════════
    (r'baseten[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Baseten Key'),
    (r'BASETEN_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Baseten Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Anyscale
    # ═══════════════════════════════════════════════════════════════════════
    (r'anyscale[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Anyscale Key'),
    (r'ANYSCALE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Anyscale Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Voyage AI
    # ═══════════════════════════════════════════════════════════════════════
    (r'voyage[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Voyage AI Key'),
    (r'VOYAGE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Voyage AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Stability AI
    # ═══════════════════════════════════════════════════════════════════════
    (r'stability[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Stability AI Key'),
    (r'STABILITY_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Stability AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Scale AI
    # ═══════════════════════════════════════════════════════════════════════
    (r'scale[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Scale AI Key'),
    (r'SCALE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Scale AI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Otter / Hermes
    # ═══════════════════════════════════════════════════════════════════════
    (r'otter[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Otter Key'),
    (r'OTTER_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Otter Env Var'),
    (r'hermes[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Hermes Key'),
    (r'HERMES_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Hermes Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Antigravity
    # ═══════════════════════════════════════════════════════════════════════
    (r'antigravity[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Antigravity Key'),
    (r'ANTIGRAVITY_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Antigravity Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Supabase
    # ═══════════════════════════════════════════════════════════════════════
    (r'supabase[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Supabase Key'),
    (r'supabase[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Supabase API Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Firebase
    # ═══════════════════════════════════════════════════════════════════════
    (r'firebase[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Firebase Key'),
    (r'FIREBASE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Firebase Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Algolia
    # ═══════════════════════════════════════════════════════════════════════
    (r'algolia[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Algolia Key'),
    (r'ALGOLIA_[A-Z_]+=[A-Z0-9]+', 'Algolia Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Clerk
    # ═══════════════════════════════════════════════════════════════════════
    (r'clerk[_-]?secret[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Clerk Secret Key'),
    (r'CLERK_SECRET_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Clerk Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Discord
    # ═══════════════════════════════════════════════════════════════════════
    (r'DISCORD[_-]?TOKEN\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Discord Token'),
    (r'Nz[A-Za-z0-9]{24}\.[A-Za-z0-9]{32}\.[A-Za-z0-9]{32}', 'Discord Token (format)'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Generic Patterns
    # ═══════════════════════════════════════════════════════════════════════
    (r'api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Generic API Key'),
    (r'secret[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Generic Secret Key'),
    (r'api[_-]?secret\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Generic API Secret'),
    (r'Bearer\s+([a-zA-Z0-9\-_]{20,})', 'Bearer Token'),
    (r'X-API-Key\s*[=:]\s*["\']?([a-zA-Z0-9\-_]{20,})', 'X-API-Key Header'),
    (r'x-api-key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'x-api-key'),
    (r'token\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Generic Token'),
    (r'TOKEN\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Token Env Var'),
    (r'secret\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Generic Secret'),
    # Password patterns - case insensitive match for 'password' word, but require actual value
    # These are prone to false positives, so we filter aggressively after matching
#    (r'(?:^|[\s:=])password\s*[=:]\s*["\']?(.{8,})["\']?', 'Password (sensitive)'),
#    (r'(?:^|[\s:=])PASSWORD\s*[=:]\s*["\']?(.{8,})["\']?', 'Password Env Var (sensitive)'),
    (r'api[_-]?password\s*[=:]?\s*["\']?([^\s"\']+)["\']?', 'API Password'),
    (r'service[_-]?account[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Service Account Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  IBM Watson
    # ═══════════════════════════════════════════════════════════════════════
    (r'ibm[_-]?watson[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'IBM Watson Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Cohere
    # ═══════════════════════════════════════════════════════════════════════
    (r'cohere[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Cohere Key'),
    (r'COHERE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Cohere Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Deepgram
    # ═══════════════════════════════════════════════════════════════════════
    (r'deepgram[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Deepgram Key'),
    (r'DEEPGRAM_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Deepgram Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  AssemblyAI
    # ═══════════════════════════════════════════════════════════════════════
    (r'assemblyai[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'AssemblyAI Key'),
    (r'ASSEMBLYAI_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'AssemblyAI Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Mistral
    # ═══════════════════════════════════════════════════════════════════════
    (r'mistral[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Mistral Key'),
    (r'MISTRAL_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Mistral Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Pinecone
    # ═══════════════════════════════════════════════════════════════════════
    (r'pinecone[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Pinecone Key'),
    (r'PINECONE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Pinecone Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Qdrant
    # ═══════════════════════════════════════════════════════════════════════
    (r'qdrant[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Qdrant Key'),
    (r'QDRANT_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Qdrant Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Weaviate
    # ═══════════════════════════════════════════════════════════════════════
    (r'weaviate[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Weaviate Key'),
    (r'WEAViate_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Weaviate Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Milvus
    # ═══════════════════════════════════════════════════════════════════════
    (r'milvus[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Milvus Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Chroma
    # ═══════════════════════════════════════════════════════════════════════
    (r'chroma[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Chroma Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  LangChain / LangSmith
    # ═══════════════════════════════════════════════════════════════════════
    (r'langsmith[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'LangSmith Key'),
    (r'LANGSMITH_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'LangSmith Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Pinecone
    # ═══════════════════════════════════════════════════════════════════════
    (r'pinecone[_-]?api[_-]?key\s*[=:]?\s*["\']?([a-zA-Z0-9\-_]{20,})', 'Pinecone Key'),
    (r'PINECONE_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Pinecone Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Pinecone Environment
    # ═══════════════════════════════════════════════════════════════════════
    (r'PINECONE_ENVIRONMENT\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Pinecone Environment'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  IBM Cloud
    # ═══════════════════════════════════════════════════════════════════════
    (r'IBM_CLOUD_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'IBM Cloud Key'),
    (r'IBM_API_KEY\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'IBM API Key'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Snowflake
    # ═══════════════════════════════════════════════════════════════════════
    (r'SNOWFLAKE_[A-Z_]+=\S+', 'Snowflake Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Databricks
    # ═══════════════════════════════════════════════════════════════════════
    (r'DATABRICKS_[A-Z_]+=\S+', 'Databricks Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Neo4j
    # ═══════════════════════════════════════════════════════════════════════
    (r'NEO4J_[A-Z_]+=\S+', 'Neo4j Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Redis
    # ═══════════════════════════════════════════════════════════════════════
    (r'REDIS_PASSWORD\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Redis Password'),
    (r'redis[_-]?password\s*[=:]?\s*["\']?([^\s"\']+)["\']?', 'Redis Password'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Postgres / SQL
    # ═══════════════════════════════════════════════════════════════════════
    (r'POSTGRES_[A-Z_]+=\S+', 'Postgres Env Var'),
    (r'DATABASE_URL\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Database URL'),
    (r'DB_PASSWORD\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'DB Password'),
    (r'PG_PASSWORD\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'Postgres Password'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  MySQL
    # ═══════════════════════════════════════════════════════════════════════
    (r'MYSQL_[A-Z_]+=\S+', 'MySQL Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  MongoDB
    # ═══════════════════════════════════════════════════════════════════════
    (r'MONGODB_[A-Z_]+=\S+', 'MongoDB Env Var'),
    (r'MONGODB_URI\s*[=:]?\s*["\']([^\s"\']+)["\']?', 'MongoDB URI'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Plaid
    # ═══════════════════════════════════════════════════════════════════════
    (r'PLAID_[A-Z_]+=\S+', 'Plaid Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  PayPal / Braintree
    # ═══════════════════════════════════════════════════════════════════════
    (r'BRAINTREE_[A-Z_]+=\S+', 'Braintree Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Coinbase / Blockchain
    # ═══════════════════════════════════════════════════════════════════════
    (r'COINBASE_[A-Z_]+=\S+', 'Coinbase Env Var'),
    (r'BLOCKCHAIN_[A-Z_]+=\S+', 'Blockchain Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  HubSpot
    # ═══════════════════════════════════════════════════════════════════════
    (r'HUBSPOT_[A-Z_]+=\S+', 'HubSpot Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Zapier
    # ═══════════════════════════════════════════════════════════════════════
    (r'ZAPIER_[A-Z_]+=\S+', 'Zapier Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Shopify
    # ═══════════════════════════════════════════════════════════════════════
    (r'SHOPIFY_[A-Z_]+=\S+', 'Shopify Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  WordPress / Jetpack
    # ═══════════════════════════════════════════════════════════════════════
    (r'WORDPRESS_[A-Z_]+=\S+', 'WordPress Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  TeamCity
    # ═══════════════════════════════════════════════════════════════════════
    (r'TEAMCITY_[A-Z_]+=\S+', 'TeamCity Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Jira
    # ═══════════════════════════════════════════════════════════════════════
    (r'JIRA_[A-Z_]+=\S+', 'Jira Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  SonarQube
    # ═══════════════════════════════════════════════════════════════════════
    (r'SONARQUBE_[A-Z_]+=\S+', 'SonarQube Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Docker Registry
    # ═══════════════════════════════════════════════════════════════════════
    (r'DOCKER_[A-Z_]+=\S+', 'Docker Env Var'),
    (r'DOCKER_REGISTRY_[A-Z_]+=\S+', 'Docker Registry Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  GitLab Runner
    # ═══════════════════════════════════════════════════════════════════════
    (r'GITLAB_[A-Z_]+=\S+', 'GitLab Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Netlify
    # ═══════════════════════════════════════════════════════════════════════
    (r'NETLIFY_[A-Z_]+=\S+', 'Netlify Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Vercel
    # ═══════════════════════════════════════════════════════════════════════
    (r'VERCEL_[A-Z_]+=\S+', 'Vercel Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Cloudflare
    # ═══════════════════════════════════════════════════════════════════════
    (r'Cloudflare_[A-Z_]+=\S+', 'Cloudflare Env Var'),
    (r'CLOUDFLARE_[A-Z_]+=\S+', 'Cloudflare Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Vultr
    # ═══════════════════════════════════════════════════════════════════════
    (r'VULTR_[A-Z_]+=\S+', 'Vultr Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  DigitalOcean
    # ═══════════════════════════════════════════════════════════════════════
    (r'DIGITALOCEAN_[A-Z_]+=\S+', 'DigitalOcean Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Linode
    # ═══════════════════════════════════════════════════════════════════════
    (r'LINODE_[A-Z_]+=\S+', 'Linode Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  OVH / SoYouStart / Kimsufi
    # ═══════════════════════════════════════════════════════════════════════
    (r'OVH_[A-Z_]+=\S+', 'OVH Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Scaleway
    # ═══════════════════════════════════════════════════════════════════════
    (r'SCARGWAY_[A-Z_]+=\S+', 'Scaleway Env Var'),
    
    # ═══════════════════════════════════════════════════════════════════════
    #  Oracle Cloud
    # ═══════════════════════════════════════════════════════════════════════
    (r'ORACLE_[A-Z_]+=\S+', 'Oracle Env Var'),
    (r'ORACLE_CLOUD_[A-Z_]+=\S+', 'Oracle Cloud Env Var'),
]


# ═══════════════════════════════════════════════════════════════════════════
#  PROVIDER CONFIGURATION - ALL AUTH STYLES
# ═══════════════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════
#  DETECTION QUALITY HELPERS
# ═══════════════════════════════════════════════════════════════════════════
CASE_SENSITIVE_KEY_TYPES = {
    'OpenAI API Key',
    'Anthropic API Key (format)',
    'OpenRouter API Key',
    'Google API Key (format)',
    'NVIDIA API Key',
    'AWS Access Key ID',
    'Stripe Live Key',
    'Stripe Test Key',
    'Stripe Publishable Live',
    'Stripe Publishable Test',
    'GitHub Personal Token',
    'GitHub OAuth Token',
    'GitHub User Token',
    'GitHub Server Token',
    'GitHub Refresh Token',
    'GitHub PAT Token',
    'GitLab Personal Access Token',
    'Slack Token',
    'Twilio Account SID',
    'Twilio API Key',
    'SendGrid API Key',
    'Mailgun Key (format)',
    'HuggingFace Token (format)',
    'Discord Token (format)',
    'Cloudflare API Token',
    'JWT',
}

PASSWORD_TYPE_FRAGMENTS = ('password',)
NON_SECRET_TYPE_FRAGMENTS = (
    'publishable',
    'account sid',
    'app creds path',
    'environment',
)
LOW_CONFIDENCE_TYPE_FRAGMENTS = (
    'generic',
    'password',
    'database url',
    'app creds',
    'environment',
)

PLACEHOLDER_WORDS = {
    'admin', 'admin123', 'apikey', 'api_key', 'api-key', 'changeme',
    'change_me', 'default', 'dummy', 'example', 'fake', 'hunter2',
    'letmein', 'none', 'null', 'password', 'passwd', 'passw0rd',
    'placeholder', 'qwerty', 'replace_me', 'root', 'sample', 'secret',
    'test', 'test123', 'test_key', 'todo', 'undefined', 'your_api_key',
    'your-api-key', 'your_password', 'your-password', 'xxx',
}

CODE_EXPRESSION_MARKERS = (
    'getenv(', 'os.getenv', 'process.env', 'system.getenv', 'getpassword',
    'setpassword', 'hashcode', 'tokenbuilder', 'tokenprovider', 'tokenmanager',
    'accesstoken', 'refreshtoken', 'buildcancellationtoken',
)


def _clean_candidate(value: str) -> str:
    """Remove regex/assignment artefacts without changing a real secret."""
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1].strip()
    return value.rstrip('"\',;')


def _assignment_value(value: str) -> str:
    """Return the RHS when a pattern captured a complete NAME=value pair."""
    match = re.match(r'^[A-Za-z_][A-Za-z0-9_.-]*\\s*[:=]\\s*(.+)$', value, re.DOTALL)
    if not match:
        return value
    return _clean_candidate(match.group(1))


def _is_placeholder(value: str, provider_prefix: bool = False) -> bool:
    value = _clean_candidate(value)
    if not value:
        return True
    lowered = value.lower()
    if lowered in {'true', 'false', 'nil', 'localhost', '127.0.0.1'}:
        return True
    if lowered.startswith(('${', '{{', '<', 'os.getenv', 'process.env', 'getenv(')):
        return True
    if re.fullmatch(r'[<\\[{(\\s].*[>\\]}\\)\\s]', value, re.DOTALL):
        return True
    if provider_prefix and lowered.startswith(('sk_test_', 'pk_test_')):
        return False
    if lowered in PLACEHOLDER_WORDS:
        return True
    if lowered in {
        'changeme123', 'correct horse battery staple', 'password123',
        'password1234', 'password12345', 'password123456',
        'password123456789', 'password1234567890', 'your_api_key_here',
        'your-api-key-here',
    }:
        return True
    if re.search(r'\\b(?:password|passwd|passw0rd|changeme|default|admin|root|secret|example|sample|dummy|fake|test|todo)\\b', lowered):
        return True
    return False


def _looks_like_code(value: str, context: str = '') -> bool:
    lowered = value.lower()
    context_lower = context.lower()
    if any(marker in lowered for marker in CODE_EXPRESSION_MARKERS):
        return True
    if any(marker in context_lower for marker in CODE_EXPRESSION_MARKERS):
        return True
    if 'password' in lowered and re.search(r'\\b(?:if|while|assert)\\b.*(?:==|!=)', context_lower):
        return True
    return False


def _has_secret_entropy(value: str) -> bool:
    """Reject dictionary-like generic values while allowing provider formats."""
    value = _clean_candidate(value)
    if len(value) < 16 or len(set(value.lower())) < 6:
        return False
    if re.fullmatch(r'(.)\\1+', value):
        return False
    classes = sum((
        bool(re.search(r'[a-z]', value)),
        bool(re.search(r'[A-Z]', value)),
        bool(re.search(r'[0-9]', value)),
        bool(re.search(r'[^A-Za-z0-9]', value)),
    ))
    if len(value) >= 20 and classes >= 2:
        return True
    if len(value) >= 32 and len(set(value.lower())) >= 8:
        return True
    return classes >= 2 and (len(set(value.lower())) / len(value)) >= 0.35


def _has_known_secret_prefix(value: str) -> bool:
    """Recognize a provider key even when it was found through a generic label."""
    if re.match(r'^sk-or-v1-[0-9A-Za-z_-]{16,}$', value):
        return True
    if re.match(r'^sk-ant-[0-9A-Za-z_-]{20,}$', value):
        return True
    if re.match(r'^sk-[0-9A-Za-z_-]{20,}$', value):
        return True
    if re.match(r'^nvapi-[0-9A-Za-z_-]{16,}$', value):
        return True
    if re.match(r'^AIza[0-9A-Za-z_-]{35}$', value):
        return True
    if re.match(r'^(?:sk|pk)_(?:live|test)_[0-9A-Za-z]{24,}$', value):
        return True
    if re.match(r'^gh[pousr]_[0-9A-Za-z]{36}$', value):
        return True
    if re.match(r'^github_pat_[0-9A-Za-z_]{20,}$', value):
        return True
    if re.match(r'^glpat-[0-9A-Za-z-]{20,}$', value):
        return True
    if re.match(r'^xox[baprs]-[0-9A-Za-z-]{20,}$', value):
        return True
    if re.match(r'^(?:AC|AP)[0-9a-fA-F]{32}$', value):
        return True
    if re.match(r'^(?:sg_|hf_|key-)[0-9A-Za-z-]{20,}$', value):
        return True
    if re.match(r'^Nz[A-Za-z0-9]{24}\\.[A-Za-z0-9]{32}\\.[A-Za-z0-9]{32}$', value):
        return True
    if re.match(r'^v1\\.[0-9A-Za-z_-]{40,}$', value):
        return True
    if re.match(r'^eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$', value):
        return True
    return False


def _confidence_for(pattern: str, key_type: str, value: str) -> str:
    lowered = key_type.lower()
    if any(fragment in lowered for fragment in PASSWORD_TYPE_FRAGMENTS):
        return 'low'
    if any(fragment in lowered for fragment in NON_SECRET_TYPE_FRAGMENTS):
        return 'low'
    if any(fragment in lowered for fragment in LOW_CONFIDENCE_TYPE_FRAGMENTS):
        return 'low'
    if r'\\S+' in pattern or re.search(r'\\[A-Z_\\]\\+=', pattern):
        return 'low'
    if _has_known_secret_prefix(value):
        return 'high'
    if key_type in CASE_SENSITIVE_KEY_TYPES or key_type.endswith('(format)'):
        return 'high'
    if key_type.endswith('Env Var'):
        return 'medium'
    if key_type in {'Bearer Token', 'X-API-Key Header', 'x-api-key', 'Service Account Key', 'AWS Secret Key'}:
        return 'medium'
    provider_words = (
        'openai', 'anthropic', 'xai', 'grok', 'elevenlabs', 'google',
        'vertex', 'nvidia', 'openrouter', 'deepseek', 'aws', 'stripe',
        'github', 'gitlab', 'slack', 'twilio', 'sendgrid', 'mailgun',
        'azure', 'mapbox', 'huggingface', 'groq', 'together', 'perplexity',
        'fireworks', 'replicate', 'runpod', 'baseten', 'anyscale', 'voyage',
        'stability', 'scale ai', 'supabase', 'firebase', 'algolia', 'clerk',
        'discord', 'ibm', 'cohere', 'deepgram', 'assemblyai', 'mistral',
        'pinecone', 'qdrant', 'weaviate', 'milvus', 'chroma', 'langsmith',
        'modal', 'otter', 'hermes', 'antigravity', 'snowflake', 'databricks',
        'neo4j', 'redis', 'plaid', 'braintree', 'coinbase', 'blockchain',
        'hubspot', 'zapier', 'shopify', 'wordpress', 'teamcity', 'jira',
        'sonarqube', 'docker', 'netlify', 'vercel', 'cloudflare', 'vultr',
        'digitalocean', 'linode', 'ovh', 'scaleway', 'oracle',
    )
    if any(word in lowered for word in provider_words):
        return 'medium'
    return 'low'


def _is_actionable(
    key_type: str,
    confidence: str,
    include_low_confidence: bool,
    include_passwords: bool,
) -> bool:
    lowered = key_type.lower()
    if 'password' in lowered and not include_passwords:
        return False
    if confidence == 'low' and not include_low_confidence:
        return False
    if any(fragment in lowered for fragment in NON_SECRET_TYPE_FRAGMENTS):
        return include_low_confidence
    return True


def _extract_match_value(match: re.Match) -> str:
    """Extract the secret rather than an alternation/capture artefact."""
    if match.lastindex:
        groups = [group for group in match.groups() if group is not None]
        if len(groups) == 1:
            value = groups[0]
        else:
            value = max(groups, key=len)
    else:
        value = match.group(0)
    return _assignment_value(_clean_candidate(value))


def _is_valid_candidate(
    pattern: str,
    key_type: str,
    value: str,
    context: str,
    include_low_confidence: bool,
    include_passwords: bool,
) -> bool:
    if not value or len(value) < 8:
        return False
    if _looks_like_code(value, context):
        return False
    confidence = _confidence_for(pattern, key_type, value)
    if not _is_actionable(key_type, confidence, include_low_confidence, include_passwords):
        return False
    provider_prefix = _has_known_secret_prefix(value)
    if _is_placeholder(value, provider_prefix=provider_prefix):
        return False
    if confidence == 'medium' and not provider_prefix and not _has_secret_entropy(value):
        return False
    return True


def redact_secret(value: str, show_prefix: bool = True, reveal: bool = False) -> str:
    """Redact a secret for terminal and JSON output."""
    if reveal:
        return value
    if not show_prefix or not value:
        return '[REDACTED]'
    visible = value[:4]
    return f'{visible}{"*" * max(8, len(value) - len(visible))}'


class ProviderAuth:
    """Configuration for how to auth with a specific provider."""
    def __init__(
        self,
        name: str,
        base_url: str,
        auth_style: str,
        auth_value: Optional[str] = None,
        auth_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        query_params: Optional[Dict[str, str]] = None,
        body_fields: Optional[Dict[str, str]] = None,
        test_model: Optional[str] = None,
        timeout: int = 60,
        response_parser: Optional[Callable] = None,
    ):
        self.name = name
        self.base_url = base_url
        self.auth_style = auth_style  # 'bearer', 'header', 'query', 'basic', 'body'
        self.auth_value = auth_value  # The actual API key to use
        self.auth_key = auth_key      # Header/query key name
        self.headers = headers or {}
        self.query_params = query_params or {}
        self.body_fields = body_fields or {}
        self.test_model = test_model
        self.timeout = timeout
        self.response_parser = response_parser


def bearer_auth(api_key: str, provider: ProviderAuth) -> Dict[str, Any]:
    """Bearer token authentication (most common)."""
    return {
        'headers': {**provider.headers, 'Authorization': f'Bearer {api_key}'},
        'query_params': provider.query_params,
        'body_fields': provider.body_fields,
    }


def header_auth(api_key: str, provider: ProviderAuth, header_key: str) -> Dict[str, Any]:
    """Custom header authentication."""
    return {
        'headers': {**provider.headers, header_key: api_key},
        'query_params': provider.query_params,
        'body_fields': provider.body_fields,
    }


def query_auth(api_key: str, provider: ProviderAuth, param_key: str) -> Dict[str, Any]:
    """Query parameter authentication."""
    return {
        'headers': provider.headers,
        'query_params': {**provider.query_params, param_key: api_key},
        'body_fields': provider.body_fields,
    }


def basic_auth(api_key: str, provider: ProviderAuth, username: str) -> Dict[str, Any]:
    """HTTP Basic Authentication."""
    import base64
    credentials = f"{username}:{api_key}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        'headers': {**provider.headers, 'Authorization': f'Basic {encoded}'},
        'query_params': provider.query_params,
        'body_fields': provider.body_fields,
    }


def body_auth(api_key: str, provider: ProviderAuth, field_name: str) -> Dict[str, Any]:
    """API key in request body."""
    return {
        'headers': provider.headers,
        'query_params': provider.query_params,
        'body_fields': {**provider.body_fields, field_name: api_key},
    }


# ═══════════════════════════════════════════════════════════════════════════
#  DEFAULT PROVIDER REGISTRY
# ═══════════════════════════════════════════════════════════════════════════
DEFAULT_PROVIDERS: Dict[str, ProviderAuth] = {
    # ────────────────────────────────────────────────────────────────────────
    # NVIDIA
    # ────────────────────────────────────────────────────────────────────────
    'nvidia': ProviderAuth(
        name='NVIDIA',
        base_url='https://integrate.api.nvidia.com/v1',
        auth_style='bearer',
        test_model='nvidia/nemotron-3-super-120b-a12b',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # OpenAI
    # ────────────────────────────────────────────────────────────────────────
    'openai': ProviderAuth(
        name='OpenAI',
        base_url='https://api.openai.com/v1',
        auth_style='bearer',
        test_model='gpt-4o-mini',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Anthropic
    # ────────────────────────────────────────────────────────────────────────
    'anthropic': ProviderAuth(
        name='Anthropic',
        base_url='https://api.anthropic.com/v1',
        auth_style='bearer',
        test_model='claude-sonnet-4-6',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Google / Vertex AI
    # ────────────────────────────────────────────────────────────────────────
    'google': ProviderAuth(
        name='Google',
        base_url='https://generativelanguage.googleapis.com/v1beta',
        auth_style='query',
        auth_key='key',  # Google uses ?key=API_KEY query parameter
        test_model='gemini-3.6-flash',  # Latest model recommended by Google API
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # OpenRouter
    # ────────────────────────────────────────────────────────────────────────
    'openrouter': ProviderAuth(
        name='OpenRouter',
        base_url='https://openrouter.ai/api/v1',
        auth_style='bearer',
        test_model=None,  # Will list models and pick one
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # DeepSeek
    # ────────────────────────────────────────────────────────────────────────
    'deepseek': ProviderAuth(
        name='DeepSeek',
        base_url='https://api.deepseek.com/v1',
        auth_style='bearer',
        test_model='deepseek-chat',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # ElevenLabs
    # ────────────────────────────────────────────────────────────────────────
    'elevenlabs': ProviderAuth(
        name='ElevenLabs',
        base_url='https://api.elevenlabs.io/v1',
        auth_style='header',
        headers={},
        test_model=None,
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Groq
    # ────────────────────────────────────────────────────────────────────────
    'groq': ProviderAuth(
        name='Groq',
        base_url='https://api.groq.com/openai/v1',
        auth_style='bearer',
        test_model='llama-3.3-70b-versatile',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Together AI
    # ────────────────────────────────────────────────────────────────────────
    'together': ProviderAuth(
        name='Together AI',
        base_url='https://api.together.ai/v1',
        auth_style='bearer',
        test_model='meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Perplexity
    # ────────────────────────────────────────────────────────────────────────
    'perplexity': ProviderAuth(
        name='Perplexity',
        base_url='https://api.perplexity.ai',
        auth_style='bearer',
        test_model='sonar',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Fireworks AI
    # ────────────────────────────────────────────────────────────────────────
    'fireworks': ProviderAuth(
        name='Fireworks AI',
        base_url='https://api.fireworks.ai/inference/v1',
        auth_style='bearer',
        test_model='accounts/fireworks/models/llama-v3p1-70b-instruct',
        timeout=60,
    ),
    
    # ────────────────────────────────────────────────────────────────────────
    # Replicate
    # ────────────────────────────────────────────────────────────────────────
    'replicate': ProviderAuth(
        name='Replicate',
        base_url='https://api.replicate.com/v1',
        auth_style='bearer',
        test_model=None,  # No simple chat endpoint; skip testing
        timeout=60,
    ),
}

# ═══════════════════════════════════════════════════════════════════════════
#  HELPER: IDENTIFY PROVIDER FROM KEY
# ═══════════════════════════════════════════════════════════════════════════
def identify_provider(key: str) -> str:
    """Identify provider based on key prefix/format."""
    key_lower = key.lower()
    
    if key.startswith('nvapi-'):
        return 'nvidia'
    if key.startswith('sk-or-v1-'):
        return 'openrouter'
    if key.startswith('sk-') and len(key) > 20:
        return 'openai'
    if key.startswith('AIza') and len(key) >= 35:
        return 'google'
    if key.startswith('sk_live_') or key.startswith('sk_test_') or key.startswith('pk_'):
        return 'stripe'
    if key.startswith('ghp_') or key.startswith('gho_') or key.startswith('ghu_') or key.startswith('ghs_') or key.startswith('ghr_'):
        return 'github'
    if key.startswith('glpat-'):
        return 'gitlab'
    if key.startswith('sg_'):
        return 'sendgrid'
    if key.startswith('hf_'):
        return 'huggingface'
    if key.startswith('xox'):
        return 'slack'
    if key.startswith('AC') and len(key) == 32:
        return 'twilio'
    if key.startswith('AP') and len(key) == 32:
        return 'twilio'
    
    # Pattern-based heuristics
    if re.match(r'openai[_-]?api[_-]?key', key_lower): return 'openai'
    if re.match(r'anthropic[_-]?api[_-]?key', key_lower): return 'anthropic'
    if re.match(r'xai[_-]?api[_-]?key', key_lower): return 'xai'
    if re.match(r'nvidia[_-]?api[_-]?key', key_lower): return 'nvidia'
    if re.match(r'elevenlabs[_-]?api[_-]?key', key_lower): return 'elevenlabs'
    if re.match(r'google[_-]?api[_-]?key', key_lower): return 'google'
    if re.match(r'google[_-]?cloud[_-]?api[_-]?key', key_lower): return 'google'
    if re.match(r'deepseek[_-]?api[_-]?key', key_lower): return 'deepseek'
    if re.match(r'groq[_-]?api[_-]?key', key_lower): return 'groq'
    if re.match(r'together[_-]?api[_-]?key', key_lower): return 'together'
    if re.match(r'perplexity[_-]?api[_-]?key', key_lower): return 'perplexity'
    if re.match(r'fireworks[_-]?api[_-]?key', key_lower): return 'fireworks'
    if re.match(r'replicate[_-]?api[_-]?key', key_lower): return 'replicate'
    
    # Env var names
    if re.match(r'OPENAI_API_KEY', key_lower): return 'openai'
    if re.match(r'ANTHROPIC_API_KEY', key_lower): return 'anthropic'
    if re.match(r'XAI_API_KEY', key_lower): return 'xai'
    if re.match(r'NVIDIA_API_KEY', key_lower): return 'nvidia'
    if re.match(r'ELEVENLABS_API_KEY', key_lower): return 'elevenlabs'
    if re.match(r'GOOGLE_API_KEY', key_lower): return 'google'
    if re.match(r'GOOGLE_CLOUD_API_KEY', key_lower): return 'google'
    if re.match(r'DEEPSEEK_API_KEY', key_lower): return 'deepseek'
    if re.match(r'GROQ_API_KEY', key_lower): return 'groq'
    if re.match(r'TOGETHER_API_KEY', key_lower): return 'together'
    if re.match(r'PPLX_API_KEY', key_lower): return 'perplexity'
    if re.match(r'FIREWORKS_API_KEY', key_lower): return 'fireworks'
    if re.match(r'REPLICATE_API_KEY', key_lower): return 'replicate'
    
    return 'unknown'


# ═══════════════════════════════════════════════════════════════════════════
#  GENERIC TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════
def run_test(
    provider: ProviderAuth,
    api_key: str,
    test_model: Optional[str] = None,
    prompt: str = "Hello! Briefly introduce yourself.",
    timeout: int = 60,
) -> Dict[str, Any]:
    """
    Generic test runner for any provider.
    
    Handles all auth styles:
    - bearer: Authorization: Bearer <key>
    - header: Custom header with key
    - query: API key as query parameter
    - basic: HTTP Basic auth
    - body: API key in request body
    
    Returns dict with status, error, response info.
    """
    start_time = time.time()
    
    # Build request components based on auth style
    headers = deepcopy(provider.headers)
    query_params = deepcopy(provider.query_params)
    body = deepcopy(provider.body_fields)
    
    if provider.auth_style == 'bearer':
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
    
    elif provider.auth_style == 'header':
        if provider.auth_key:
            headers[provider.auth_key] = api_key
    
    elif provider.auth_style == 'query':
        if provider.auth_key:
            query_params[provider.auth_key] = api_key
    
    elif provider.auth_style == 'basic':
        import base64
        credentials = f"user:{api_key}"
        encoded = base64.b64encode(credentials.encode()).decode()
        headers['Authorization'] = f'Basic {encoded}'
    
    elif provider.auth_style == 'body':
        if provider.auth_key:
            body[provider.auth_key] = api_key
    
    # Set test model
    if test_model:
        body['model'] = test_model
    
    # Add prompt for chat models (standard for most providers)
    if test_model and 'messages' not in body:
        # Google uses 'contents' instead of 'messages'
        if provider.name.lower() == 'google':
            body['contents'] = [{'role': 'user', 'parts': [{'text': prompt}]}]
            body['generationConfig'] = {'maxOutputTokens': 100, 'temperature': 0.7}
        else:
            body['messages'] = [{'role': 'user', 'content': prompt}]
            body['max_tokens'] = 100
            body['temperature'] = 0.7
    
    # Build full URL
    # Google uses different URL format: /v1beta/models/{model}:generateContent
    if provider.name.lower() == 'google':
        url = f"{provider.base_url}/models/{test_model}:generateContent"
    else:
        url = f"{provider.base_url}/chat/completions"
    
    try:
        response = requests.post(
            url,
            headers=headers,
            params=query_params,
            json=body,
            timeout=timeout,
        )
        elapsed = time.time() - start_time
        
        result = {
            'status_code': response.status_code,
            'elapsed': round(elapsed, 2),
            'url': url,
        }
        
        if response.status_code == 200:
            try:
                data = response.json()
                # Google uses different response format
                if provider.name.lower() == 'google':
                    content = (
                        data.get('candidates', [{}])[0]
                        .get('content', {})
                        .get('parts', [{}])[0]
                        .get('text', '')[:150]
                    )
                else:
                    content = (
                        data.get('choices', [{}])[0]
                        .get('message', {})
                        .get('content', '')[:150]
                    )
                result['content'] = content
                result['status'] = 'success'
                result['raw_response'] = response.text[:500]
            except json.JSONDecodeError:
                result['status'] = 'error'
                result['error'] = f'Invalid JSON response: {response.text[:200]}'
                result['raw_response'] = response.text[:500]
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', response.text[:100])
                result['error'] = error_msg
                
                # NVIDIA API returns this error when key is valid but request is malformed
                # This means the key worked - auth passed, just need proper payload
                if error_msg == 'Input required: specify "prompt" or "messages"':
                    result['status'] = 'success'
                    result['content'] = '[Key validated - auth passed]'
                # 503 Service Unavailable - if we got here, auth likely passed first
                # Server overloaded AFTER accepting the key - treat as likely valid
                elif response.status_code == 503:
                    result['status'] = 'success'
                    result['content'] = '[Key validated - server overloaded, but auth passed]'
                # Missing Authorization header - key format wrong or not sent
                elif 'Missing or invalid Authorization header' in error_msg:
                    result['status'] = 'auth_error'
                    result['error'] = 'Key auth failed - invalid or missing Authorization header'
                else:
                    result['status'] = 'error'
            except (json.JSONDecodeError, AttributeError):
                result['error'] = response.text[:100]
                result['status'] = 'error'
            result['raw_response'] = response.text[:500]
        
        return result
    
    except requests.exceptions.Timeout:
        return {
            'status': 'error',
            'status_code': 408,
            'error': 'Request timed out',
            'elapsed': round(time.time() - start_time, 2),
            'url': url,
        }
    except requests.exceptions.ConnectionError as e:
        return {
            'status': 'error',
            'status_code': 0,
            'error': f'Connection error: {e}',
            'elapsed': round(time.time() - start_time, 2),
            'url': url,
        }
    except Exception as e:
        return {
            'status': 'error',
            'status_code': 0,
            'error': f'Unexpected error: {type(e).__name__}: {str(e)[:200]}',
            'elapsed': round(time.time() - start_time, 2),
            'url': url,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  KEY FINDER
# ═══════════════════════════════════════════════════════════════════════════
def redact_secret(value: str, show_prefix: bool = True) -> str:
    """Return the full value - no redaction on private machines."""
    return value


def is_text_file(filepath: str) -> bool:
    """Check if a file is likely text (not binary)."""
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(8192)
            if b'\x00' in chunk:
                return False
            try:
                chunk.decode('utf-8')
                return True
            except UnicodeDecodeError:
                return False
    except (IOError, OSError):
        return False


def has_relevant_extension(filepath: str) -> bool:
    """Check if file has an extension we care about."""
    filename = Path(filepath).name.lower()
    
    # Dotfiles like .env, .npmrc, .netrc have no real suffix - match by name.
    # Path('.env').suffix == '' so the extension check below would miss them.
    dotfile_names = {
        '.env', '.gitignore', '.gitconfig', '.npmrc', '.pypirc', '.netrc',
        '.dockercfg', '.zshrc', '.zprofile', '.bashrc', '.bash_profile',
        '.profile', '.dockerfile',
    }
    if filename in dotfile_names or filename.startswith('.env'):
        return True
    
    ext = Path(filepath).suffix.lower()
    relevant = {
        '.env', '.env.local', '.env.production', '.env.staging',
        '.json', '.yaml', '.yml', '.cfg', '.conf', '.ini',
        '.config', '.properties', '.py', '.js', '.ts', '.jsx', '.tsx',
        '.sh', '.bash', '.zsh', '.rb', '.pl', '.go', '.rs',
        '.java', '.php', '.swift', '.kt', '.kts', '.c', '.cpp',
        '.h', '.hpp', '.cs', '.vb', '.ps1', '.bat', '.cmd',
        '.tf', '.tfvars', '.toml', '.md', '.txt', '.rst', '.adoc',
        '.dockerfile', '.gitignore', '.gitconfig', '.npmrc',
        '.pypirc', '.netrc', '.dockercfg',
    }
    return ext in relevant


def should_skip_dir(path: str) -> bool:
    """Skip directories that are huge or irrelevant."""
    path_lower = path.lower()
    
    # Direct substring patterns
    skip_patterns = [
        # Version control & build artifacts
        '/node_modules', '/__pycache__',
        '/__pycache__',
        
        # Package manager caches
        '/.local/share', '/.cargo', '/.rustup',
        '/.npm', '/.yarn', '/.pnpm', '/.pip',
        
        # System directories
        '/Applications', '/System', '/cores',
        '/proc', '/sys',
        '/Library/Caches',
        
        # OSA-specific generated content (from logs)
        '/.system_generated', '/scratch/',
        '/references/', '/docs/', '/documentation/', '/examples/',
    ]
    
    for pattern in skip_patterns:
        if pattern in path_lower:
            return True
    
    # Don't skip cache directories - they might contain API keys
    # Only skip known problematic patterns above
    return False


def scan_file(filepath: str) -> List[Dict[str, Any]]:
    """Scan a single file for API keys."""
    results = []
    
    try:
        size = os.path.getsize(filepath)
        if size > 1_000_000:  # Skip > 1MB
            return results
        if not is_text_file(filepath):
            return results
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Skip minified JS bundles that produce tons of false positives
        # These are typically single-line files > 50KB with many matches
        if filepath.endswith('.js') or filepath.endswith('.mjs'):
            line_count = content.count('\n') + 1
            if line_count == 1 and size > 50_000:
                # Minified JS bundle - be more selective
                pass  # Continue but with filtering below
        
        
        for pattern, key_type in KEY_PATTERNS:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                raw = match.group(0)
                # Get captured group if available
                if match.groups():
                    raw = match.group(1)
                
                # Still skip very short matches (< 8 chars) but keep everything else
                if len(raw) < 8:
                    continue
                
                # Skip matches that are clearly regex patterns or code, not actual keys
                raw_lower = raw.lower()
                
                # Skip values that look like code/regex, not actual secrets
                if any(x in raw_lower for x in ['os.getenv', 'getenv(', '\\s*', '\\s*', '[=:]', '|token|', '|bearer|', '|authorization|']):
                    continue
                
                line_num = content[:match.start()].count('\n') + 1
                context = content[max(0, match.start()-50):min(len(content), match.end()+50)]
                
                results.append({
                    'key': raw,
                    'type': key_type,
                    'filepath': filepath,
                    'line': line_num,
                    'context': context,
                    'redacted': redact_secret(raw),
                })
    
    except (IOError, OSError, PermissionError):
        pass
    
    # If this is a minified JS bundle with many matches, filter to only specific provider types
    if len(results) > 5 and (filepath.endswith('.js') or filepath.endswith('.mjs')):
        js_bundle_filter = [
            'OpenAI API Key', 'OpenRouter API Key', 'NVIDIA API Key',
            'Google API Key', 'Anthropic Env Var', 'AWS Access Key',
            'Stripe Live Key', 'Stripe Test Key', 'GitHub Personal Token',
            'ElevenLabs API Key', 'DeepSeek Env Var',
        ]
        filtered = [r for r in results if r['type'] in js_bundle_filter]
        if filtered:                    results = filtered
    
    return results


def should_skip_file(filepath: str, skip_libraries: bool = True) -> bool:
    """Check if a file should be skipped even if it has a relevant extension.
    
    Args:
        filepath: Path to check
        skip_libraries: If True, skip library directories (node_modules, vendor, .pkg, etc.)
    """
    path_lower = filepath.lower()
    
    # Core skip patterns - always skip these
    skip_patterns = [
        # Generated system content
        '/.system_generated/', '/scratch/', '/steps/',
        
        # Large reference/content files
        '/references/', '/docs/', '/documentation/', '/examples/',
        
        # Test data directories - high false positive rate
        '/testdata/', '/test_data/', '/tests/testdata/',
        '/_testdata/', '/testcases/',
    ]
    
    # Library patterns - skip only if skip_libraries is True
    library_skip_patterns = [
        # Package/vendor directories (never edited by user, low key value)
        '/node_modules/', '/vendor/', '/.git/',
        '/.pkg/', 
        '/go/pkg/mod/',
    ]
    
    # Combine patterns based on skip_libraries flag
    all_patterns = skip_patterns
    if skip_libraries:
        all_patterns = skip_patterns + library_skip_patterns
    
    for pattern in all_patterns:
        if pattern in path_lower:
            return True
    
    # Skip very large files
    try:
        if os.path.getsize(filepath) > 500_000:
            return True
    except (IOError, OSError):
        pass
    
    return False


def scan_directory(path: str, results: List[Dict[str, Any]], progress_callback: Optional[Callable[[int, int, str], bool]] = None, skip_libraries: bool = True) -> int:
    """Recursively scan a directory.
    
    Args:
        path: Directory path to scan
        results: List to append found keys to
        progress_callback: Optional callback for progress reporting
        skip_libraries: If True, skip library directories (node_modules, vendor, .pkg, etc.)
    """
    global _progress_active, _files_scanned, _current_path, _progress_lock
    
    count = 0
    total_files = 0
    
    # First pass: count total files to scan
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not should_skip_dir(os.path.join(root, d))]
            for file in files:
                filepath = os.path.join(root, file)
                if has_relevant_extension(filepath) and not should_skip_file(filepath, skip_libraries):
                    total_files += 1
    except (IOError, OSError, PermissionError):
        pass
    
    scanned = 0
    try:
        for root, dirs, files in os.walk(path):
            # Skip huge/irrelevant dirs
            dirs[:] = [d for d in dirs if not should_skip_dir(os.path.join(root, d))]
            
            for file in files:
                filepath = os.path.join(root, file)
                if not has_relevant_extension(filepath):
                    continue
                
                # Skip based on path patterns
                if should_skip_file(filepath, skip_libraries):
                    continue
                
                scanned += 1
                found = scan_file(filepath)
                if found:
                    # Filter out likely false positives
                    filtered_found = []
                    for f in found:
                        fp = f['filepath']
                        key = f['key']
                        key_lower = key.lower()
                        
                        # Skip any key value containing 'password' or user-specified false positive terms
                        # These appear in actual key values (not field names) and indicate placeholder/fake keys
                        if any(p in key_lower for p in ['password', 'authusers', 'securitytoken', 'environment', 
                                                        'revocation', 'checkpoint', 'service_account', 'otheroutput']):
                            continue
                        
                        # In package dirs, skip generic patterns that are likely false positives
                        if any(x in fp.lower() for x in ['/node_modules/', '/.pkg/', '/vendor/']):
                            if f['type'] in ['Generic API Key', 'Generic Token', 'Generic Secret', 'Generic Secret Key']:
                                # Keep only specific provider patterns
                                if not any(p in f['type'] for p in ['OpenAI', 'NVIDIA', 'Google', 'Anthropic', 'AWS', 'Stripe', 'GitHub']):
                                    continue
                        
                        # Skip passwords containing code patterns
                        if 'password' in f['type'].lower():
                            code_patterns = [
                                'credentials', 'getpassword', 'hashcode', 'equals(',
                                'password;', 'password.)', 'password.', 'password)', 'password(',
                                'getpass', 'setpassword', '.getpassword',
                                'authentication', '.class', ');', 'ask_password',
                                # pip/setuptools password patterns
                                'hashfunc', 'password:',
                                # Existing additional false positive patterns
                                'your_api_key_here', 'imap_password', 'concatenationtotoken',
                                'getcancellationtoken', 'support', 'execution', 'keyfromexistingkeystore',
                                'sourcedesc', 'findproperty', 'internals', 'redacted',
                                'forauthenticateduser', 'pitfalls', 'exception', 'authenticated',
                                'schema', 'seanet', 'composer', 'project', 'surface',
                                'interactionsonwhitespace', 'creation', 'typescript', 'google',
                                'decoration', 'confirmation', 'surface-primary', 'interactive',
                                'anthropicapikey', 'template', 'virtualizationenabled',
                                'newlines', 'pim', 'xchacha', 'smartcardpinauthoperation',
                                'sg_webrequiredfieldmissing', '_linestatement_begin', 'initial',
                                'named_alternation', 'deadbeef', 'component', 'srequestnexttokenstring',
                                'restrictionsallowresourceslist', 'smanagersecretpolicy',
                                'requestsecondstoliveinteger', 'toauthenticatetarget', 'managerarnorjsonpath',
                                'balancesinputmaxresultsinteger', 'sensitive', 'modifying',
                                'namerequiredexception', 'validityoutofboundsexception', 'smanagersecretresourcedata',
                                'serialization', 'typeerror', 'username', 'none', 'syntax',
                                'protocols-exception', 'protocols', 'tunnel_token', 'iser_password_', 'excecption',
                                'classification', 'response_wrapper',
                                'get_auth_from_url', 'linking-protocols', 'sk-linking', 'sk_cli', 'sk_open',
                                'protocol:', 'protocol_', 'linking', 'cli_', '_cli',
                                # NEW false positive patterns from user list
                                'default', 'do_not', 'background', 'cancellation', 'keystone',
                                'cipher', 'oath_token', 'oath-token', 'endpointauth',
                                'managementresponse', 'google_search', 'generation_config',
                                'efficient-tools', 'extra_args', 'least_param', 'googlesearch',
                                'identity', 'update', 'void', 'string', 'dialog_button',
                                ';const', 'tunnel_token', 'webrequired', 'authoperation',
                                'content', 'optional', 'stream=stream', 'class:',
                                'button', 'home-composer', 'Bearer',
                                'async', 'interactionson', 'source:',
                                'first_paint', 'google_workspace', 'textured', 'textord',
                                ';switch', 'anthropicapi', 'account',
                                # User-specified false positive patterns for password field
                                'authusers', 'securitytoken', 'environment', 'revocation',
                                'checkpoint', 'service_account', 'otheroutput',
                                # Any key value containing 'password' is a false positive
                                'password',
                            ]
                            if any(p in key_lower for p in code_patterns):
                                continue
                            if len(key) < 15:
                                continue
                            if key_lower.strip() in ['passw0rd', 'passwd', 'pw', 'imap_password']:
                                continue
                        
                        # Skip Generic Tokens that are clearly code, not actual tokens
                        if 'generic token' in f['type'].lower():
                            token_code_patterns = [
                                'buildcancellationtoken', 'gettoken', 'createtoken',
                                'refreshtoken', 'accesstoken', 'tokencache',
                                'tokenbuilder', 'tokenprovider', 'tokenmanager',
                                # False positive patterns from falsepositives.txt
                                'getcancellationtoken', 'forauthenticateduser', '@@sourcedesc@@',
                                'endpointauthbasicresponse', 'async_tostreamed_response_wrapper',
                                'izer_handles_norm_exceptions', 'swithstreamingresponse',
                                'fordinneridentity', 's_generated_by_server', 'managercertificateconfig',
                            ]
                            if any(p in key_lower for p in token_code_patterns):
                                continue
                        
                        # Skip Generic API Keys that are clearly code/placeholders, not actual keys
                        if 'generic api key' in f['type'].lower():
                            api_key_patterns = [
                                # Format patterns and placeholders
                                'key-syntax-differences-and-pitfalls', 'paste_tunnel_token_here',
                                'your_api_key_here', 'sk-linking', 'sk_cli', 'sk_open',
                            ]
                            if any(p in key_lower for p in api_key_patterns):
                                continue
                        
                        # Skip Generic Secrets that are clearly code, not actual secrets
                        if 'generic secret' in f['type'].lower():
                            secret_code_patterns = [
                                's-for-the-authenticated-user', 'forauthenticateduser',
                                'managercertificateconfig', '_internals_do_not_use',
                                '_do_not_pass_this_or_you_will_be', '_template_with_default_value',
                                'smanagersecretpolicy', 'restrictionsallowresourceslist',
                            ]
                            if any(p in key_lower for p in secret_code_patterns):
                                continue
                        
                        filtered_found.append(f)
                    
                    if filtered_found:
                        results.extend(filtered_found)
                        count += len(filtered_found)
                        # Trigger key found notification with source path
                        for f in filtered_found:
                            trigger_key_found_blink(f['type'], f['key'], filepath)
                else:
                    count += 1
                
                # Update module-level progress (for background thread)
                with _progress_lock:
                    _files_scanned = scanned
                    _current_path = filepath
                
                # Also call callback if provided
                if progress_callback:
                    if progress_callback(scanned, total_files, filepath):
                        break
    except (IOError, OSError, PermissionError):
        pass
    return count


def scan_path(path: str, results: List[Dict[str, Any]], progress_callback: Optional[Callable[[int, int, str], bool]] = None, skip_libraries: bool = True) -> int:
    """Scan a path (file or directory)."""
    global _progress_active, _files_scanned, _current_path, _progress_lock
    
    if os.path.isfile(path):
        found = scan_file(path)
        if found:
            results.extend(found)
            # Trigger key found notification with source path
            for f in found:
                trigger_key_found_blink(f['type'], f['key'], path)
        else:
            results.extend(found)
        
        # Update module-level progress (for background thread)
        with _progress_lock:
            _files_scanned += 1
            _current_path = path
        
        # Call progress callback if provided
        if progress_callback:
            progress_callback(1, 1, path)
        return len(found)
    elif os.path.isdir(path):
        return scan_directory(path, results, progress_callback, skip_libraries)
    return 0


# ═══════════════════════════════════════════════════════════════════════════
#  TEST RUNNER FOR SPECIFIC PROVIDER
# ═══════════════════════════════════════════════════════════════════════════
def test_key(key_info: Dict[str, Any], provider_registry: Dict[str, ProviderAuth] = None) -> Dict[str, Any]:
    """Test a found key against its provider."""
    provider_registry = provider_registry or DEFAULT_PROVIDERS
    
    key = key_info['key']
    provider_name = identify_provider(key)
    provider = provider_registry.get(provider_name)
    
    if not provider:
        return {
            **key_info,
            'provider': provider_name,
            'status': 'skipped',
            'error': f'No test handler for provider: {provider_name}',
        }
    
    # Determine test model
    test_model = provider.test_model
    if not test_model:
        # For providers without a default test model, try to list and pick
        pass
    
    result = run_test(provider, key, test_model)
    
    return {
        **key_info,
        'provider': provider_name,
        'endpoint': result.get('url', provider.base_url),
        'status_code': result.get('status_code'),
        'status': result.get('status', 'error'),
        'error': result.get('error'),
        'content': result.get('content'),
        'elapsed': result.get('elapsed'),
        'raw_response': result.get('raw_response'),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  ELITE ANSI FORMATTING
# ═══════════════════════════════════════════════════════════════════════════
def draw_loading_bar(progress: float, width: int = 40) -> str:
    """Draw a loading bar with gradient effect."""
    filled = int(width * progress)
    bar = '█' * filled + '░' * (width - filled)
    
    # Color gradient from red to green
    if progress < 0.5:
        color = ANSI.ORANGE if progress < 0.25 else ANSI.YELLOW
    elif progress < 0.75:
        color = ANSI.NEON_GREEN
    else:
        color = ANSI.NEON_GREEN
    
    return f"{color}{bar}{ANSI.RESET}"


def format_path_display(path: str, max_len: int = 120) -> str:
    """Truncate and format a path for display."""
    path = path.replace(os.environ.get('HOME', ''), '~')
    if len(path) <= max_len:
        return path
    return '...' + path[-(max_len - 3):]


KEY_COLORS = {
    'OpenAI': 'CYAN',
    'NVIDIA': 'NEON_GREEN',
    'Google': 'YELLOW',
    'Anthropic': 'MAGENTA',
    'ElevenLabs': 'BRIGHT_MAGENTA',
    'OpenRouter': 'BRIGHT_BLUE',
    'DeepSeek': 'ORANGE',
    'Groq': 'TEAL',
    'Stripe': 'RED',
    'GitHub': 'BRIGHT_CYAN',
    'AWS': 'GOLD',
    'Generic': 'LIGHT_GRAY',
}

# Collected keys display buffer
_collected_keys_buffer = []

last_progress_display = ""

def progress_reporter():
    """Background thread that reports scanning progress on one line.
    Only updates when something changes - doesn't constantly overwrite."""
    global _progress_active, _files_scanned, _current_path, _key_found_blink, _last_key_found
    global _collected_keys_buffer, last_progress_display
    
    while _progress_active:
        with _progress_lock:
            path = _current_path
            scanned = _files_scanned
            blink = _key_found_blink
            last_key = _last_key_found
        
        # Build display only if something meaningful changed
        should_update = False
        display = last_progress_display
        
        if path:
            # Groovy animated indicator (changes every scan)
            indicators = ['▰', '▱', '▮', '▯', '◉', '○', '◌', '◎']
            indicator = indicators[scanned % len(indicators)]
            
            # Key found blink effect - show on its own for visibility
            blink_text = ""
            if blink > 0 and last_key[0]:
                key_type = last_key[0]
                key_value = last_key[1]
                source_path = last_key[2] if len(last_key) > 2 else ""
                
                # Get color for key type
                color_name = 'CYAN'  # default
                for prefix, color in KEY_COLORS.items():
                    if prefix.lower() in key_type.lower():
                        color_name = color
                        break
                
                color = getattr(ANSI(), color_name, ANSI().CYAN)
                
                # Show key type and value with path - use actual buffer count
                current_count = len(_collected_keys_buffer)
                preview = key_value[:35] + ("..." if len(key_value) > 35 else "")
                blink_text = f" {ANSI().GOLD}◆{current_count:03d}◆{ANSI().RESET} {color}{key_type}{ANSI().RESET} = {ANSI().BRIGHT_WHITE}{preview}{ANSI().RESET}"
                if source_path:
                    blink_text += f" {ANSI().DARK_GRAY}←{ANSI().RESET} {ANSI().LIGHT_GRAY}{format_path_display(source_path)}{ANSI().RESET}"
                _key_found_blink -= 1
                should_update = True  # Definitely update when key found
            elif blink > 0:
                blink_text = f" {ANSI().GOLD}✦ KEY FOUND ✦{ANSI().RESET}"
                _key_found_blink -= 1
                should_update = True
            
            new_display = f"{ANSI().BRIGHT_CYAN}▸{ANSI().RESET} {indicator} {ANSI().CYAN}{format_path_display(path)}{ANSI().RESET}{blink_text}"
            
            # Only update if changed OR key was just found
            if new_display != last_progress_display or should_update:
                # Clear and write new display
                sys.stderr.write(f"\r{' ' * 200}\r")
                sys.stderr.write(f"\r{new_display}")
                sys.stderr.flush()
                last_progress_display = new_display
        
        time.sleep(0.2)  # Slower update - only when something changes


def trigger_key_found_blink(key_type: str = "", key_value: str = "", source_path: str = ""):
    """Trigger a visual indicator that a key was found."""
    global _key_found_blink, _last_key_found, _collected_keys_buffer
    _key_found_blink = 4  # Show for ~4 updates (~0.8 seconds)
    _last_key_found = (key_type, key_value, source_path)
    
    # Add to growing display buffer
    _collected_keys_buffer.append((key_type, key_value, source_path))


def display_collected_keys_box():
    """Display a growing box of all collected keys with full details."""
    global _collected_keys_buffer

    if not _collected_keys_buffer:
        return ""

    ansi = ANSI()
    min_box_width = 50
    max_box_width = 120

    def limit_visible(text: str, width: int) -> str:
        """Limit plain text to a visible width without allowing line wrapping."""
        text = str(text)
        if ansi.visible_length(text) <= width:
            return text
        suffix = "..."
        available = max(0, width - ansi.visible_length(suffix))
        result = ""
        for char in text:
            if ansi.visible_length(result + char) > available:
                break
            result += char
        return result + suffix

    def boxed_line(content: str, width: int) -> str:
        """Build a line whose visible width is never greater than the box width."""
        prefix = f"{ansi.ELECTRIC_BLUE}║{ansi.RESET} "
        suffix = f" {ansi.ELECTRIC_BLUE}║{ansi.RESET}"
        padding = width - (
            ansi.visible_length(prefix)
            + ansi.visible_length(content)
            + ansi.visible_length(suffix)
        )
        return prefix + content + (" " * max(0, padding)) + suffix

    # Keep each field within a fixed budget so no entry can exceed max_box_width.
    formatted_entries = []
    for i, (key_type, key_value, source_path) in enumerate(_collected_keys_buffer, 1):
        color = ansi.CYAN
        for prefix, color_name in KEY_COLORS.items():
            if prefix.lower() in key_type.lower():
                color = getattr(ansi, color_name, ansi.CYAN)
                break

        type_display = limit_visible(key_type, 24)
        key_display = limit_visible(key_value, 48)
        path_display = limit_visible(format_path_display(source_path, 30), 30)
        entry_content = (
            f"{ansi.GOLD}◆{i:03d}◆{ansi.RESET} "
            f"{color}{type_display}{ansi.RESET} = "
            f"{ansi.BRIGHT_WHITE}{key_display}{ansi.RESET} "
            f"{ansi.DARK_GRAY}←{ansi.RESET} "
            f"{ansi.LIGHT_GRAY}{path_display}{ansi.RESET}"
        )
        formatted_entries.append(entry_content)

    longest_visible = max(
        (ansi.visible_length(entry) for entry in formatted_entries),
        default=0,
    )
    box_width = min(max(longest_visible + 4, min_box_width), max_box_width)

    inner_width = box_width - 2
    top_border = ansi.gradient_text(
        '╔' + '═' * inner_width + '╗',
        (0, 255, 200),
        (255, 100, 200),
    )
    bot_border = ansi.gradient_text(
        '╚' + '═' * inner_width + '╝',
        (255, 100, 200),
        (0, 255, 200),
    )
    mid_border = top_border.replace('═', '─').replace('╔', '╠').replace('╗', '╣')

    lines = [top_border]
    header_content = (
        f"{ansi.GOLD}◆ COLLECTED API KEYS "
        f"({len(_collected_keys_buffer)}){ansi.RESET}"
    )
    lines.append(boxed_line(header_content, box_width))
    lines.append(mid_border)

    for entry_content in formatted_entries:
        lines.append(boxed_line(entry_content, box_width))

    lines.append(bot_border)
    lines.append("")
    return "\n".join(lines)


def banner() -> str:
    """Generate the elite banner."""
    ansi = ANSI()
    lines = [
        ansi.cyber_title("█ K-RAD API KEY SCANNER & TESTER █", 72, gradient=True),
        "",
    ]

    def boxed_line(content: str, width: int, border_color: str) -> str:
        """Build a fixed-width line using visible lengths for all padding."""
        prefix = f"{border_color}║{ansi.RESET} "
        suffix = f" {border_color}║{ansi.RESET}"
        padding = width - (
            ansi.visible_length(prefix)
            + ansi.visible_length(content)
            + ansi.visible_length(suffix)
        )
        return prefix + content + (" " * max(0, padding)) + suffix

    # Info container
    info_items = [
        ("█ ACTIVATED:", "Scanning filesystem for API keys..."),
        ("█ TESTING:", "Live validation against provider APIs..."),
    ]
    info_width = 80
    for label, value in info_items:
        content = (
            f"{ansi.fg_rgb(100, 255, 200)}{label} "
            f"{ansi.CYAN}{value}{ansi.RESET}"
        )
        lines.append(boxed_line(content, info_width, ansi.ELECTRIC_BLUE))

    lines.append("")

    # Security warning box
    warning_title = "⚠  SECURITY WARNING  ⚠️"
    warning_lines = [
        "Keys found on your drive may be exposed.",
        "Rotate any keys not meant for plaintext.",
        "Never commit API keys to version control.",
    ]
    warning_width = max(
        ansi.visible_length(warning_title),
        *(ansi.visible_length(line) for line in warning_lines),
    ) + 6

    lines.append(
        ansi.gradient_text(
            '╔' + '═' * (warning_width - 2) + '╗',
            (255, 50, 50),
            (255, 200, 0),
        )
    )
    lines.append(
        boxed_line(
            f"{ansi.YELLOW}{warning_title}{ansi.RESET}",
            warning_width,
            ansi.BRIGHT_RED,
        )
    )
    for warning_line in warning_lines:
        lines.append(
            boxed_line(
                f"{ansi.LIGHT_GRAY}{warning_line}{ansi.RESET}",
                warning_width,
                ansi.BRIGHT_RED,
            )
        )
    lines.append(
        ansi.gradient_text(
            '╚' + '═' * (warning_width - 2) + '╝',
            (255, 200, 0),
            (255, 50, 50),
        )
    )
    lines.append("")

    return "\n".join(lines)


def draw_key_card(key_info: Dict[str, Any], is_working: bool, verbose: bool = False) -> str:
    """Draw a stylized result card in the terminal."""
    ansi = ANSI()
    
    if is_working:
        border = f"{ansi.BG_BRIGHT_GREEN} {ansi.RESET}"
        status_icon = f"{ansi.BRIGHT_GREEN}✓ WORKING{ansi.RESET}"
        header_color = ansi.BRIGHT_GREEN
    else:
        border = f"{ansi.BG_BRIGHT_RED} {ansi.RESET}"
        status_icon = f"{ansi.BRIGHT_RED}✗ FAILED{ansi.RESET}"
        header_color = ansi.BRIGHT_RED
    
    lines = [
        f"{ansi.BOLD}{header_color}╔{'═' * 68}╗{ansi.RESET}",
        f"{border}",
        f"{ansi.BOLD}{header_color}║ {ansi.RESET} {key_info['type']}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Provider: {key_info['provider']}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Status:   {status_icon}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Endpoint: {key_info.get('endpoint', 'N/A')}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Model:    {key_info.get('test_model', key_info.get('model', 'N/A'))}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Key:      {key_info['redacted']}",
        f"{ansi.BOLD}{header_color}║{ansi.RESET}  Source:   {key_info['filepath']}:{key_info.get('line', '?')}",
    ]
    
    if key_info.get('content'):
        lines.append(f"{ansi.BOLD}{header_color}║{ansi.RESET}  Response: {key_info['content']}")
    
    if key_info.get('elapsed'):
        lines.append(f"{ansi.BOLD}{header_color}║{ansi.RESET}  Time:     {key_info['elapsed']}s")
    
    if key_info.get('error'):
        lines.append(f"{ansi.BOLD}{header_color}║{ansi.RESET}  Error:    {key_info['error'][:100]}")
    
    if verbose and key_info.get('raw_response'):
        lines.append(f"{ansi.BOLD}{header_color}║{ansi.RESET}  Raw:     {key_info['raw_response'][:200]}")
    
    lines.append(f"{ansi.BOLD}{header_color}╚{'═' * 68}╝{ansi.RESET}")
    lines.append("")
    
    return "\n".join(lines)


def summary_banner(working: List[Dict], non_working: List[Dict]) -> str:
    """Draw summary with elite styling."""
    ansi = ANSI()
    total = len(working) + len(non_working)
    
    lines = [
        "",
        f"{ansi.BRIGHT_CYAN}{'═' * 80}{ansi.RESET}",
        f"{ansi.BRIGHT_CYAN}📊  SCAN SUMMARY{ansi.RESET}",
        f"{ansi.BRIGHT_CYAN}{'═' * 80}{ansi.RESET}",
        "",
        f"{ansi.NEON_GREEN}  ✓ WORKING:{ansi.RESET}     {len(working)}",
        f"{ansi.BRIGHT_RED}  ✗ NON-WORKING:{ansi.RESET} {len(non_working)}",
        f"{ansi.GOLD}  ─────────{ansi.RESET}",
        f"{ansi.GOLD}  📈 TOTAL:{ansi.RESET}        {total}",
        "",
    ]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(
        description=(
            'Elite API Key Scanner & Tester\n'
            'Scans the filesystem for API keys and tests them live.\n'
            'Supports Bearer, Header, Query, Basic, and Body authentication.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''Examples:
  %(prog)s                         Scan the home directory and test keys
  %(prog)s -p /path/to/configs     Scan a specific path
  %(prog)s -f /path/to/config.json  Scan a specific file
  %(prog)s -f config.json -v       Scan a file with verbose output
  %(prog)s -p /Users/me -v         Scan a path with verbose output
  %(prog)s -p /home/user -j        Output results as JSON
  %(prog)s --include-libraries     Include library directories
''',
    )

    parser.add_argument(
        '-p', '--path',
        action='append',
        default=[],
        help='Path to scan; may be specified multiple times',
    )
    parser.add_argument(
        '-f', '--file',
        action='append',
        default=[],
        help='File to scan; may be specified multiple times',
    )
    parser.add_argument('-v', '--verbose', action='store_true', help='Show verbose output')
    parser.add_argument('-j', '--json', action='store_true', help='Output results as JSON')
    parser.add_argument('--no-color', action='store_true', help='Disable colored output')
    parser.add_argument(
        '--max-size',
        type=int,
        default=1_000_000,
        help='Maximum file size to scan, in bytes (default: 1000000)',
    )
    parser.add_argument(
        '--include-libraries',
        action='store_true',
        help='Include library directories such as node_modules and vendor',
    )
    
    args = parser.parse_args()
    
    # Disable colors if requested
    if args.no_color:
        for attr in dir(ANSI):
            if not attr.startswith('_') and isinstance(getattr(ANSI, attr), str):
                setattr(ANSI, attr, '')
    
    ansi = ANSI()
    
    # Print banner
    print(banner())
    print(f"{ansi.CYAN}Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{ansi.RESET}")
    print(f"{ansi.CYAN}Search paths: {', '.join(args.path or ['/home directory'])}{ansi.RESET}")
    print(f"{ansi.CYAN}Specific files: {', '.join(args.file or ['none'])}{ansi.RESET}")
    print(f"{ansi.CYAN}Verbose: {args.verbose}{ansi.RESET}")
    print(f"{ansi.CYAN}Include libraries: {args.include_libraries}{ansi.RESET}")
    print(f"{ansi.CYAN}Max file size: {args.max_size / 1024 / 1024:.1f} MB{ansi.RESET}")
    print("")
    
    # ──────────────────────────────────────────────────────────────────────────
    # SCAN PHASE
    # ──────────────────────────────────────────────────────────────────────────
    print(f"{ansi.ELECTRIC_BLUE}╔══════════════════════════════════════════════════════════════════════════╗{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}║{ansi.RESET} {ansi.fg_rgb(150, 220, 255)}█ SCANNING FOR API KEYS{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}╚══════════════════════════════════════════════════════════════════════════╝{ansi.RESET}")
    print("")
    
    # Progress reporting setup
    print("")
    sys.stdout.flush()

    global _progress_active, _files_scanned, _current_path
    _progress_active = True
    _files_scanned = 0
    _current_path = ""

    progress_thread = threading.Thread(target=progress_reporter, daemon=True)
    progress_thread.start()

    key_results = []
    
    home = os.environ.get('HOME', '/')
    
    # If specific files are provided, ONLY scan those files
    if args.file:
        for fpath in args.file:
            if os.path.isfile(fpath):
                scan_path(fpath, key_results, skip_libraries=not args.include_libraries)
    # If paths are provided, scan those paths
    elif args.path:
        for path in args.path:
            if os.path.exists(path):
                scan_path(path, key_results, skip_libraries=not args.include_libraries)
    # Otherwise scan home config files AND home directory
    else:
        # Scan home config files
        home_configs = [
            '.bashrc', '.bash_profile', '.zshrc', '.zprofile', '.profile',
            '.env', '.env.local', '.env.production', '.env.staging',
            '.gitconfig', '.ssh/config', '.npmrc', '.pypirc', '.netrc',
        ]
        for fname in home_configs:
            fpath = os.path.join(home, fname)
            if os.path.isfile(fpath):
                scan_path(fpath, key_results, skip_libraries=not args.include_libraries)

        # Also scan home directory
        scan_path(home, key_results, skip_libraries=not args.include_libraries)
    
    # Deduplicate by key value
    seen = set()
    unique_results = []
    for r in key_results:
        if r['key'] not in seen:
            seen.add(r['key'])
            unique_results.append(r)
    
    print(f"{ansi.GREEN}✓ Found {len(unique_results)} unique API key(s){ansi.RESET}")
    print("")
    
    # Display collected keys box
    if _collected_keys_buffer:
        print(display_collected_keys_box())
    
    # ─────────────────────────────────────────────────────────────────────────
    # TEST PHASE
    # ─────────────────────────────────────────────────────────────────────────
    print(f"{ansi.ELECTRIC_BLUE}╔══════════════════════════════════════════════════════════════════════════╗{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}║{ansi.RESET} {ansi.fg_rgb(150, 220, 255)}█ TESTING API KEYS{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}╚══════════════════════════════════════════════════════════════════════════╝{ansi.RESET}")
    print("")
    
    working = []
    non_working = []
    
    for i, key_info in enumerate(unique_results, 1):
        provider_name = identify_provider(key_info['key'])
        print(f"{ansi.YELLOW}[{i}/{len(unique_results)}] Testing {key_info['type']}", end="")
        print(f"{ansi.LIGHT_GRAY} ({provider_name})...{ansi.RESET}", end="")
        
        result = test_key(key_info)
        
        if result['status'] == 'success':
            working.append(result)
            print(f" {ansi.BRIGHT_GREEN}✓{ansi.RESET} ({result.get('elapsed', '?')}s)")
            if result.get('content'):
                print(f"    {ansi.NEON_GREEN}→{ansi.RESET} {result['content'][:80]}{ansi.RESET}")
        else:
            non_working.append(result)
            print(f" {ansi.BRIGHT_RED}✗{ansi.RESET} ({result.get('elapsed', '?')}s)")
            if result.get('error'):
                print(f"    {ansi.BRIGHT_RED}✗{ansi.RESET} {result['error'][:80]}{ansi.RESET}")
        
        time.sleep(0.5)  # Rate limiting
    
    # ─────────────────────────────────────────────────────────────────────────
    # OUTPUT PHASE
    # ─────────────────────────────────────────────────────────────────────────
    print("")
    print(f"{ansi.ELECTRIC_BLUE}╔══════════════════════════════════════════════════════════════════════════╗{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}║{ansi.RESET} {ansi.fg_rgb(150, 220, 255)}█ RESULTS{ansi.RESET}")
    print(f"{ansi.ELECTRIC_BLUE}╚══════════════════════════════════════════════════════════════════════════╝{ansi.RESET}")
    print("")
    
    if args.json:
        output = {
            'timestamp': datetime.now().isoformat(),
            'total': len(unique_results),
            'working': len(working),
            'non_working': len(non_working),
            'working_keys': working,
            'non_working_keys': non_working,
        }
        print(json.dumps(output, indent=2))
    else:
        # Working keys
        print(f"{ansi.BRIGHT_GREEN}{'=' * 70}{ansi.RESET}")
        print(f"{ansi.BRIGHT_GREEN}✓ WORKING KEYS ({len(working)}){ansi.RESET}")
        print(f"{ansi.BRIGHT_GREEN}{'=' * 70}{ansi.RESET}")
        print("")
        
        if working:
            for entry in working:
                print(draw_key_card(entry, is_working=True, verbose=args.verbose))
        else:
            print(f"{ansi.YELLOW}No working keys found.{ansi.RESET}")
            print("")
        
        # Non-working keys
        print(f"{ansi.BRIGHT_RED}{'=' * 70}{ansi.RESET}")
        print(f"{ansi.BRIGHT_RED}✗ NON-WORKING KEYS ({len(non_working)}){ansi.RESET}")
        print(f"{ansi.BRIGHT_RED}{'=' * 70}{ansi.RESET}")
        print("")
        
        if non_working:
            for entry in non_working:
                print(draw_key_card(entry, is_working=False, verbose=args.verbose))
        else:
            print(f"{ansi.GREEN}All keys working!{ansi.RESET}")
            print("")
        
        # Summary
        print(summary_banner(working, non_working))
        print(f"{ansi.BRIGHT_YELLOW}⚠ SECURITY WARNING:{ansi.RESET} Review any keys found immediately!")
        print(f"{ansi.BRIGHT_YELLOW}⚠ Rotate any keys not meant for plaintext storage.{ansi.RESET}")
        print(f"{ansi.BRIGHT_YELLOW}⚠ Never commit API keys to version control.{ansi.RESET}")
    
    # Stop progress reporting
    _progress_active = False
    progress_thread.join(timeout=1)
    
    # Clear progress line
    print("")
    
    # Save JSON results
    output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key_test_results.json")
    with open(output_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total': len(unique_results),
            'working': len(working),
            'non_working': len(non_working),
            'working_keys': working,
            'non_working_keys': non_working,
        }, f, indent=2)
    
    print(f"")
    print(f"{ansi.CYAN}Results saved to: {output_file}{ansi.RESET}")
    print(f"{ansi.CYAN}{'=' * 60}{ansi.RESET}")
    print(f"{ansi.BRIGHT_GREEN}✓ Scan Complete!{ansi.RESET}")
    print(f"{ansi.CYAN}{'=' * 60}{ansi.RESET}")


if __name__ == '__main__':
    main()
