#!/usr/bin/env python3
"""
Legion Congressional Trade Disclosure Scraper
Coordinates 1,000 nodes for scraping House and Senate data
"""

import json
import sqlite3
import argparse
from pathlib import Path
from typing import List, Dict
from datetime import datetime

def create_database(db_path: str = "congress-trades.db"):
    """Create SQLite database for congressional trades"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS filings (
            filing_id TEXT PRIMARY KEY,
            chamber TEXT,
            year INTEGER,
            member_name TEXT,
            member_state TEXT,
            member_district TEXT,
            owner_type TEXT,
            filing_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filing_id TEXT,
            ticker TEXT,
            asset_name TEXT,
            transaction_type TEXT,
            description TEXT,
            trade_date TEXT,
            notification_date TEXT,
            amount_min INTEGER,
            amount_max INTEGER,
            capital_gains INTEGER,
            FOREIGN KEY (filing_id) REFERENCES filings(filing_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS legion_nodes (
            node_id TEXT PRIMARY KEY,
            role TEXT,
            status TEXT,
            last_heartbeat TEXT,
            assigned_years TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"Database created at {db_path}")

def load_node_assignment(node_id: str, role: str, assigned_years: List[int]):
    """Register a Legion node"""
    conn = sqlite3.connect("congress-trades.db")
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO legion_nodes 
        (node_id, role, status, last_heartbeat, assigned_years)
        VALUES (?, ?, 'active', ?, ?)
    ''', (node_id, role, datetime.utcnow().isoformat(), json.dumps(assigned_years)))
    
    conn.commit()
    conn.close()

def merge_jsonl_files(input_dir: Path, output_file: str):
    """Merge all JSONL files into single output"""
    all_filings = []
    
    for jsonl_file in input_dir.glob("*.jsonl"):
        with open(jsonl_file, 'r') as f:
            for line in f:
                if line.strip():
                    all_filings.append(json.loads(line))
    
    with open(output_file, 'w') as f:
        for filing in all_filings:
            f.write(json.dumps(filing) + '\n')
    
    print(f"Merged {len(all_filings)} filings to {output_file}")

def import_to_database(jsonl_file: str, db_path: str = "congress-trades.db"):
    """Import JSONL data into SQLite"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    with open(jsonl_file, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            
            filing = json.loads(line)
            
            # Insert filing
            cursor.execute('''
                INSERT OR IGNORE INTO filings 
                (filing_id, chamber, year, member_name, member_state, member_district, owner_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                filing.get('filing_id'),
                filing.get('chamber', 'House'),
                filing.get('year'),
                filing.get('member_name'),
                filing.get('member_state'),
                filing.get('member_district'),
                filing.get('owner_type', 'SP')
            ))
            
            # Insert transactions
            for trans in filing.get('transactions', []):
                cursor.execute('''
                    INSERT OR IGNORE INTO transactions
                    (filing_id, ticker, asset_name, transaction_type, description,
                     trade_date, notification_date, amount_min, amount_max, capital_gains)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    filing.get('filing_id'),
                    trans.get('ticker'),
                    trans.get('asset_name'),
                    trans.get('transaction_type'),
                    trans.get('description'),
                    trans.get('date'),
                    trans.get('notification_date'),
                    trans.get('amount_min', 0),
                    trans.get('amount_max', 0),
                    1 if trans.get('capital_gains') else 0
                ))
    
    conn.commit()
    
    # Print stats
    cursor.execute('SELECT COUNT(*) FROM filings')
    filing_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM transactions')
    trans_count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"Imported to database: {filing_count} filings, {trans_count} transactions")

def query_trades(db_path: str = "congress-trades.db", **filters):
    """Query trades with filters"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    where_clauses = []
    params = []
    
    if 'ticker' in filters:
        where_clauses.append("ticker = ?")
        params.append(filters['ticker'])
    
    if 'chamber' in filters:
        where_clauses.append("chamber = ?")
        params.append(filters['chamber'])
    
    if 'year' in filters:
        where_clauses.append("year = ?")
        params.append(filters['year'])
    
    if 'member_name' in filters:
        where_clauses.append("member_name LIKE ?")
        params.append(f"%{filters['member_name']}%")
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    cursor.execute(f'''
        SELECT t.*, f.member_name, f.chamber, f.year
        FROM transactions t
        JOIN filings f ON t.filing_id = f.filing_id
        WHERE {where_sql}
        ORDER BY f.year DESC, t.trade_date DESC
        LIMIT 100
    ''', params)
    
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return results

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Legion Congressional Trade Scrapper')
    subparsers = parser.add_subparsers(dest='command')
    
    # Create database
    db_parser = subparsers.add_parser('init-db', help='Initialize database')
    
    # Merge files
    merge_parser = subparsers.add_parser('merge', help='Merge JSONL files')
    merge_parser.add_argument('--input-dir', default='data/raw', help='Input directory')
    merge_parser.add_argument('--output', default='data/merged.jsonl', help='Output file')
    
    # Import to DB
    import_parser = subparsers.add_parser('import', help='Import JSONL to database')
    import_parser.add_argument('jsonl_file', help='JSONL input file')
    import_parser.add_argument('--db', default='congress-trades.db', help='Database path')
    
    # Query
    query_parser = subparsers.add_parser('query', help='Query trades')
    query_parser.add_argument('--ticker', help='Filter by ticker')
    query_parser.add_argument('--chamber', choices=['House', 'Senate'], help='Filter by chamber')
    query_parser.add_argument('--year', type=int, help='Filter by year')
    query_parser.add_argument('--member', help='Filter by member name')
    
    args = parser.parse_args()
    
    if args.command == 'init-db':
        create_database()
    elif args.command == 'merge':
        merge_jsonl_files(Path(args.input_dir), args.output)
    elif args.command == 'import':
        import_to_database(args.jsonl_file, args.db)
    elif args.command == 'query':
        filters = {k: v for k, v in vars(args).items() 
                   if k in ['ticker', 'chamber', 'year', 'member'] and v is not None}
        results = query_trades('congress-trades.db', **filters)
        print(json.dumps(results, indent=2))
    else:
        parser.print_help()