#!/usr/bin/env python3
"""
House Congressional Trade Disclosure Scraper
Scrapes PTR (Periodic Transaction Report) data from House Clerk website
"""

import fitz  # PyMuPDF
import requests
import zipfile
import io
import re
import json
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
import concurrent.futures
import time

HEADERS = {"User-Agent": "Mozilla/5.0 (Legion/1.0)"}
BASE_URL = "https://disclosures-clerk.house.gov"


@dataclass
class Transaction:
    ticker: str
    asset_name: str
    transaction_type: str  # P/S
    description: str
    date: str
    notification_date: str
    amount_min: int
    amount_max: int
    capital_gains: bool


@dataclass
class Filing:
    filing_id: str
    year: int
    member_name: str
    member_state: str
    member_district: str
    owner_type: str  # SP/JT/DC
    transactions: List[Transaction]


def extract_amount_range(text: str) -> tuple:
    """Extract amount range from PTR text"""
    # Match patterns like "$1,001 - $15,000" or "$1,000,001 - $5,000,000"
    match = re.search(r'\$?([0-9,]+)\s*-\s*\$?([0-9,]+)', text)
    if match:
        amount_min = int(match.group(1).replace(',', ''))
        amount_max = int(match.group(2).replace(',', ''))
        return amount_min, amount_max
    
    # Single amount
    match = re.search(r'\$?([0-9,]+)\s*$', text.strip())
    if match:
        amount = int(match.group(1).replace(',', ''))
        return amount, amount
    
    return 0, 0


def parse_ptr_pdf(pdf_path: str) -> Optional[Dict[str, Any]]:
    """Parse a House PTR PDF filing and return dict"""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        
        # Extract filing ID
        filing_match = re.search(r'Filing ID #(\d+)', text)
        if not filing_match:
            return None
        
        filing_id = filing_match.group(1)
        
        # Extract member info - name
        name_match = re.search(r'Hon\.\s+([^\n]+)', text)
        member_name = name_match.group(1).strip() if name_match else "Unknown"
        
        # Extract state/district
        state_match = re.search(r'State/District:\s+([A-Z]{2})(\d+)?', text)
        member_state = state_match.group(1) if state_match else "Unknown"
        district = state_match.group(2) if state_match and len(state_match.groups()) >= 2 else ""
        
        # Extract year from filing ID
        year = int(filing_id[:4]) if len(filing_id) >= 4 and filing_id[:4].isdigit() else datetime.now().year
        
        # Parse transactions from columnar PDF layout
        transactions = parse_transactions_from_text(text)
        
        return {
            "filing_id": filing_id,
            "chamber": "House",
            "year": year,
            "member_name": member_name,
            "member_state": member_state,
            "member_district": district,
            "owner_type": "SP",
            "transactions": transactions
        }
    except Exception as e:
        print(f"Error parsing {pdf_path}: {e}")
        return None


def parse_transactions_from_text(text: str) -> List[Dict[str, Any]]:
    """Parse transactions from PTR PDF text"""
    transactions = []
    lines = text.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Look for ticker pattern: "TICKER (Description) [ST/OP/FD/etc]"
        ticker_match = re.search(r'([A-Z]{1,5})\s+([^\n]+)\s+\[([A-Z]+)\]', line)
        
        if ticker_match:
            ticker = ticker_match.group(1)
            asset_desc = ticker_match.group(2).strip()
            asset_type = ticker_match.group(3)
            
            # Look for owner type in preceding context
            owner_match = re.search(r'\b(SP|JT|DC)\b', line[:50])
            owner_type = owner_match.group(1) if owner_match else "SP"
            
            # Check next line for transaction type (P/S)
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                type_match = re.search(r'\b([PS])\b', next_line)
                trans_type = type_match.group(1) if type_match else "S"
                
                # Look for amount in subsequent lines
                amount_text = ""
                for j in range(i + 1, min(i + 5, len(lines))):
                    if '$' in lines[j]:
                        amount_text += lines[j]
                
                amount_min, amount_max = extract_amount_range(amount_text) if amount_text else (0, 0)
                if amount_min == 0 and amount_max == 0:
                    amount_min = amount_max = 1001  # Default minimum
                
                # Check for capital gains mark
                gains_match = re.search(r'[gGfF]\s*$', next_line)
                capital_gains = bool(gains_match)
                
                transactions.append({
                    "ticker": ticker,
                    "asset_name": asset_desc.replace('(', '[').replace(')', ']') if '(' in asset_desc else ticker,
                    "transaction_type": trans_type,
                    "description": "Purchase" if trans_type == "P" else "Sale",
                    "date": "",
                    "notification_date": "",
                    "amount_min": amount_min,
                    "amount_max": amount_max,
                    "capital_gains": capital_gains
                })
            
            i += 1
        i += 1
    
    return transactions


def scrape_house_year(year: int, output_dir: Path, max_workers: int = 3) -> List[Dict]:
    """Scrape House PTRs for a specific year using FTP-style index"""
    filings = []
    
    # House PTRs are available via bulk ZIP files or per-PDF
    # Try to get index from the public_disc endpoint
    
    # Known working URL pattern from congressional-trading project:
    # https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{docId}.pdf
    
    # First, try to get a list of filings from recent searches
    # The site doesn't expose a public index, so we need to discover filings
    
    # Scrape recent filings from the House search page
    search_url = f"{BASE_URL}/FinancialDisclosure/ViewSearch"
    
    # Alternative: Check if we can get filings by member
    # This is a simplified approach - production would need more sophisticated crawling
    
    return filings


def scrape_house_bulk(year: int, output_file: str) -> int:
    """Scrape using bulk ZIP index approach"""
    import os
    
    # Try to construct the known index URL patterns
    patterns = [
        # From congressional-trading documentation
        f"{BASE_URL}/public_disc/financial-pdfs/{year}/{year}FD.zip",
        f"{BASE_URL}/public_disc/ptr-index-{year}.zip",
        f"{BASE_URL}/FinancialDisclosure/ptr-index-{year}.zip",
    ]
    
    for pattern_url in patterns:
        try:
            print(f"Trying: {pattern_url}")
            resp = requests.get(pattern_url, headers=HEADERS, timeout=60)
            
            if resp.status_code == 200:
                print(f"Success! Found index at {pattern_url}")
                # Process ZIP file
                process_house_zip(resp.content, year, output_file)
                return 1
        except Exception as e:
            print(f"Failed {pattern_url}: {e}")
            continue
    
    return 0


def process_house_zip(zip_content: bytes, year: int, output_file: str):
    """Process a House ZIP file containing PTR PDFs"""
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        zip_path = tmp_path / f"house-{year}.zip"
        
        with open(zip_path, 'wb') as f:
            f.write(zip_content)
        
        with zipfile.ZipFile(zip_path, 'r') as zf:
            pdf_files = [n for n in zf.namelist() if n.endswith('.pdf')]
            print(f"Found {len(pdf_files)} PDF files in ZIP")
            
            with open(output_file, 'w') as out_f:
                for pdf_name in pdf_files[:10]:  # Limit for testing
                    try:
                        with zf.open(pdf_name) as pdf_f:
                            pdf_bytes = pdf_f.read()
                        
                        pdf_path = tmp_path / pdf_name
                        with open(pdf_path, 'wb') as f:
                            f.write(pdf_bytes)
                        
                        result = parse_ptr_pdf(str(pdf_path))
                        if result:
                            out_f.write(json.dumps(result) + '\n')
                    except Exception as e:
                        print(f"Error processing {pdf_name}: {e}")


def scrape_senate_efd() -> List[Dict]:
    """
    Scrape Senate eFD system
    Note: Senate eFD requires JavaScript-rendered HTML with login
    """
    from bs4 import BeautifulSoup
    
    results = []
    base_url = "https://efdsearch.senate.gov"
    
    # The Senate eFD search interface
    # After accepting terms, filers can be viewed at:
    # https://efdsearch.senate.gov/search/view/ptr/
    
    # Each filing has a UUID
    # Example: https://efdsearch.senate.gov/search/view/ptr/a8e388bc-72c5-4227-b6f3-64b7bb779883
    
    # This would require:
    # 1. Accept terms of service
    # 2. Parse search results
    # 3. Extract filing details
    
    # For now, return empty list - implementation needs selenium/puppeteer
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Congressional Trade Disclosure Scraper')
    subparsers = parser.add_subparsers(dest='command')
    
    # House bulk scrape
    house_parser = subparsers.add_parser('house-bulk', help='Scrape House PTRs from bulk ZIP')
    house_parser.add_argument('year', type=int, help='Year to scrape')
    house_parser.add_argument('--output', default='data/house-trades.jsonl', help='Output file')
    
    # Senate scrape
    senate_parser = subparsers.add_parser('senate', help='Scrape Senate eFD data')
    senate_parser.add_argument('--output', default='data/senate-trades.jsonl', help='Output file')
    
    args = parser.parse_args()
    
    if args.command == 'house-bulk':
        output_path = Path(args.output)
        output_path.parent.mkdir(exist_ok=True)
        scrape_house_bulk(args.year, str(args.output))
    elif args.command == 'senate':
        results = scrape_senate_efd()
        with open(args.output, 'w') as f:
            for r in results:
                f.write(json.dumps(r) + '\n')
        print(f"Scraped {len(results)} Senate filings")


if __name__ == '__main__':
    main()