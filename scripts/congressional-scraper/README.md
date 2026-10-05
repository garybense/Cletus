# Congressional Trade Disclosure Scraper for 1,000-Node Legion

Scrapes US House and Senate financial disclosure data for congressional stock trades under STOCK Act.

## Executive Summary

**No public API exists without keys.** All commercial services (Quiver, CongressTrade, etc.) require paid API keys.

## Working Paid APIs

| Service | Cost | Features |
|---------|------|----------|
| **Quiver Quantitative** | $30+/mo | Congressional trades, lobbying, contracts |
| **congress.trade** | $5-50/yr | Real-time, webhooks, CSV export |
| **CongressTradesAPI** | $99+/mo | Voting records + trades, alerts |
| **EODHD** | $15+/mo | Excess return calculations |

## Direct Scraping (No API Key Required)

### House Clerk Data

```bash
# PTR PDFs (Periodic Transaction Reports)
https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{docId}.pdf

# Index files (bulk download)
https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}/{YEAR}FD.zip

# Financial Disclosure Reports  
https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}/{docId}.pdf
```

**Filing ID format**: `{year}{5-digit-id}` (e.g., 20011070)

### Senate eFD Data

- **Location**: https://efdsearch.senate.gov/
- **Search**: `/search/view/ptr/` (post-login HTML interface)
- **Each filing**: UUID-based URL (e.g., `a8e388bc-72c5-4227-b6f3-64b7bb779883`)

### Known Working PDF Example

```
https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20025603.pdf
```

## Data Format

### House PTR PDF Structure

```
PerioDic tranSaction rePort
filer information
Name: Hon. Earl Blumenauer
State/District: OR03
Transactions
TICKER (Description) [ST]
P 07/09/2024 08/06/2024 $15,001 - $50,000 g
```

### Senate eFD HTML Structure

- Search table with filer name, report type, filing date
- Individual filing pages contain transaction tables
- CSRF tokens required for form submissions

## Legion Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Node 1-100: House PTR bulk scraper (parallel by year)     │
├─────────────────────────────────────────────────────────────┤
│  Node 101-500: House PDF parser (pdfplumber/PyMuPDF)       │
├─────────────────────────────────────────────────────────────┤
│  Node 501-800: Senate eFD scraper (puppeteer/selenium)     │
├─────────────────────────────────────────────────────────────┤
│  Node 801-900: Data normalizer & deduplicator              │
├─────────────────────────────────────────────────────────────┤
│  Node 901-1000: SQLite exporter + JSON indexes             │
└─────────────────────────────────────────────────────────────┘
```

## Tools Provided

```bash
# Initialize the database
python3 legion_scraper.py init-db

# Scrape House (bulk ZIP approach)
python3 scrape_house.py house-bulk 2024 --output data/house-2024.jsonl

# Query the database
python3 legion_scraper.py query --ticker NVDA --chamber House
python3 legion_scraper.py query --member Pelosi --year 2024
```

## Rate Limits & Ethics

- **House**: No official rate limit, delay 0.5s between PDFs
- **Senate**: CSRF tokens, no bulk access documented
- **TOU**: Use responsibly, respect server load

## Open Source Alternatives

| Project | Language | House | Senate | Features |
|---------|----------|-------|--------|----------|
| capitol-api | Node.js | ✓ | ✗ | Self-hostable |
| congressional-trading | Python | ✓ | ✗ | REST API |
| CongressInvest | Python | ✓ | ✗ | Dashboard |

## Sample Output

```json
{
  "filing_id": "20025603",
  "chamber": "House",
  "year": 2024,
  "member_name": "Earl Blumenauer",
  "member_state": "OR",
  "member_district": "03",
  "transactions": [
    {
      "ticker": "BAX",
      "asset_name": "Baxter International Inc.",
      "transaction_type": "P",
      "description": "Purchase",
      "date": "2024-07-09",
      "amount_min": 15001,
      "amount_max": 50000,
      "capital_gains": false
    }
  ]
}
```