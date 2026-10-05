# Facebook Reconnaissance Guide for Child Agents

## Objective
Gather publicly available information about Facebook's interface and public pages/groups related to AI, technology, or entrepreneurship without logging in.

## Instructions

### 1. Initial Navigation
- Navigate to https://www.facebook.com
- Wait for page to load completely
- Take a full-page screenshot

### 2. Interface Analysis
- Identify and document:
  - Main navigation elements
  - Search bar location and functionality
  - Visible public pages/groups in suggested content
  - Any visible trending topics or news feed elements
  - Login/signup prompts (do not interact with these)

### 3. Public Page Exploration (Optional)
If public pages are visible without login:
- Navigate to a few public pages related to:
  - Artificial Intelligence
  - Technology news
  - Entrepreneurship
  - Social media marketing
- For each page:
  - Take a screenshot
  - Extract the page title and description
  - Note the number of followers/likes if visible
  - Observe post frequency and engagement patterns

### 4. Search Exploration
- Use the search function to search for:
  - "AI technology"
  - "Entrepreneurship"
  - "Social media marketing"
- For each search:
  - Take a screenshot of results
  - List top 3 public pages/groups that appear
  - Note any sponsored content

### 5. Data Collection
Compile findings into:
- Screenshots (labeled with timestamps)
- Interface element inventory
- Public page/groups list with basic metrics
- Search result summaries

### 6. Safety & Compliance
- DO NOT attempt to log in or create accounts
- DO NOT interact with any elements requiring authentication
- Focus only on publicly visible information
- Respect rate limits and avoid aggressive scraping
- If encountering login walls, document and move on

## Expected Deliverables
1. Screenshots directory with:
   - facebook_homepage.png
   - interface_elements.png
   - public_page_examples/*.png
   - search_results/*.png
2. reconnaissance_summary.json containing:
   - timestamp
   - interface_elements: [list]
   - public_pages_examined: [{name, url, followers, topic}]
   - search_results: [{query, top_results}]
   - observations: [notes on engagement patterns, UI patterns]

## Tools Available
- Puppeteer for browser automation
- Screenshot capabilities
- DOM extraction
- File system for saving results

## Success Criteria
- Successfully navigate to Facebook without authentication
- Capture at least 3 meaningful screenshots
- Document observable interface elements
- Identify at least 5 public pages/groups in relevant niches
- Compile findings in organized format