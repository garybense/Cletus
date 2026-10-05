# Facebook Graph API Research Report

## Overview
The Facebook Graph API is the primary way for apps to read and write to the Facebook social graph. It's an HTTP-based API that apps can use to programmatically query data, post new stories, manage ads, upload photos, and perform a wide variety of other tasks.

**Latest Version:** v26.0 (as of documentation accessed)
**Base URL:** https://graph.facebook.com/
**Protocol:** HTTPS required (HTTP/1.1)

## Core Concepts
The Graph API is structured around the concept of a "social graph" composed of:
- **Nodes:** Individual objects with unique IDs (Users, Pages, Posts, Photos, etc.)
- **Edges:** Connections between objects (friends, photos, likes, comments, etc.)
- **Fields:** Properties of objects (name, email, birthday, etc.)

## Authentication Methods
Almost all Graph API endpoints require an access token. Different token types serve different purposes:

### 1. User Access Tokens
- Allow apps to take actions based on user input
- Required for reading/modifying/writing a person's Facebook data
- Obtained via Facebook Login dialog with user permission
- Can be short-lived (1-2 hours) or long-lived (~60 days)
- Platform-specific SDKs handle automatic management

### 2. Page Access Tokens
- Allow reading, writing, and modifying data belonging to a Facebook Page
- Obtained by exchanging a user access token via Graph API
- Unique to each Page, admin, and app combination

### 3. App Access Tokens
- Allow reading and modifying app settings
- Generated using app secret via server-to-server call
- **Important:** Never expose in client-side code as it reveals app secret

### 4. System User Access Tokens
- Enable programmatic, automated actions on Ad objects or Pages
- Used without requiring input from app users or re-authentication
- Requires setup in Business Settings with assigned assets

### 5. Client Tokens
- Identify app when calling app-level APIs from native/desktop apps
- Not secret (embedded in apps)
- Must be combined with App ID: `{app-id}|{client-token}`

### Token Generation Examples
**App Access Token:**
```bash
curl -X GET "https://graph.facebook.com/oauth/access_token?client_id={your-app-id}&client_secret={your-app-secret}&grant_type=client_credentials"
```

**Alternative Method (hiding app secret):**
```bash
curl -i -X GET "https://graph.facebook.com/{api-endpoint}&access_token={your-app_id}|{your-app_secret}"
```

## API Endpoints Structure
### Basic Request Format
All requests go to `https://graph.facebook.com/{object-id}/{edge-name}?{parameters}`

### Examples
**Get User Information:**
```bash
curl -i -X GET "https://graph.facebook.com/USER-ID?access_token=ACCESS-TOKEN"
```
Returns:
```json
{
  "name": "Your Name",
  "id": "YOUR-USER-ID"
}
```

**Get User's Photos:**
```bash
curl -i -X GET "https://graph.facebook.com/USER-ID/photos?access_token=ACCESS-TOKEN"
```

**Post to User's Feed:**
```bash
curl -i -X POST "https://graph.facebook.com/USER-ID/feed?message=Hello%20World&access_token=ACCESS-TOKEN"
```

### Common Root Nodes
Documentation shows extensive reference for nodes including:
- `/user` - User information
- `/page` - Facebook Pages
- `/post` - Feed stories
- `/photo` - Photos
- `/video` - Videos
- `/event` - Events
- `/group` - Groups
- `/album` - Photo albums
- `/comment` - Comments
- `/reaction` - Reactions (likes, loves, etc.)
- `/adcampaign` - Advertising campaigns
- And many more specialized nodes

## Making Requests
### HTTP Methods
- **GET:** Read data
- **POST:** Create/write data
- **DELETE:** Remove data
- **POST with method=override:** Update data (for older clients)

### Parameters
- `access_token`: Required for most endpoints
- Field selection: Use `fields` parameter to specify exactly what data to return
- Limiting results: Use `limit` parameter
- Pagination: Use `after`/`before` cursors from pagination responses

### Field Expansion
Minimize data transfer by requesting only needed fields:
```
https://graph.facebook.com/USER-ID?fields=id,name,email,picture
```

### Batch Requests
Send multiple API requests in a single HTTP request to reduce overhead.

## Rate Limiting & Limitations
### Platform Rate Limits
Applied when using application or user access tokens:

**For Applications:**
- Calls within one hour = 200 × Number of Users
- Number of Users based on daily active users (falls back to weekly/monthly during low engagement)
- Not a per-user limit - total app calls cannot exceed this maximum

**For Users:**
- Individual user call count during rolling one hour window
- Actual values not revealed due to privacy concerns

### Business Use Case (BUC) Rate Limits
Applied when using system user or page access tokens (for Marketing API, Instagram Platform, etc.)

### Rate Limit Headers
Responses include headers showing current usage when enough calls have been made.

### Throttling
When limits exceeded:
- API requests fail
- Error code returned until call count drops below limit
- If both Platform and BUC limits apply, BUC limits take precedence

## Error Handling
Common error patterns documented include:
- Authentication failures
- Permission denied errors
- Rate limiting errors (HTTP 4xx, often 429)
- Invalid parameters
- Object not found

## Security Considerations
- All requests must use HTTPS
- HSTS includeSubdomains enabled on facebook.com
- Access tokens should be handled securely
- Never hard-code app secrets in client-side code
- Use platform SDK access token classes for automatic management and refresh

## Best Practices
1. Start with Graph API Explorer tool for testing
2. Use field expansion to minimize data transfer
3. Implement proper error handling
4. Respect rate limits and implement backoff strategies
5. Use webhooks for real-time updates instead of polling
6. Keep SDKs updated
7. Follow Facebook Platform Policies
8. Use appropriate token types for your use case
9. Store access tokens securely
10. Implement token refresh mechanisms for long-lived tokens

## Resources for Developers
- Graph API Explorer tool (built-in testing)
- SDKs for various platforms (iOS, Android, JavaScript, PHP)
- Webhooks for real-time notifications
- Batch requests for efficiency
- Comprehensive reference documentation
- Changelog for version tracking
- Debugging and error handling guides

## Conclusion
The Facebook Graph API provides a powerful, flexible interface to access Facebook's social graph data. Success with the API requires understanding:
1. The node/edge/field data model
2. Proper authentication and token management
3. Rate limiting constraints
4. Best practices for efficient, secure usage
5. Error handling and debugging techniques

The API is well-documented with extensive reference materials, making it accessible for developers familiar with RESTful APIs and OAuth concepts.