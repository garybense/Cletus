import requests
import os
from bs4 import BeautifulSoup

def get_shodan_api_key():
    username = os.getenv("SHODAN_USERNAME")
    password = os.getenv("SHODAN_PASSWORD")

    if not username or not password:
        print("Error: SHODAN_USERNAME and SHODAN_PASSWORD environment variables must be set.")
        return

    session = requests.Session()
    
    # 1. Get the login page to retrieve the CSRF token (if applicable)
    login_url = "https://account.shodan.io/login"
    try:
        response = session.get(login_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for CSRF token in hidden input field
        token_input = soup.find('input', {'name': 'token'})
        token = token_input['value'] if token_input else ""
        
        # 2. Perform Login
        # Note: This is an approximation of the login form fields
        payload = {
            'username': username,
            'password': password,
            'token': token
        }
        
        response = session.post(login_url, data=payload)
        
        # 3. Navigate to account page
        account_page = session.get("https://account.shodan.io/")
        
        # 4. Extract API key from the account page
        # Usually found in an element like <input id="api-key" value="..."> or similar
        soup = BeautifulSoup(account_page.text, 'html.parser')
        
        # Look for the API key in the page
        # Adjust selector based on actual page structure
        api_key_element = soup.find('input', {'id': 'api-key'})
        if api_key_element:
            print(api_key_element.get('value'))
        else:
            # Fallback search for text that looks like a key if ID not found
            # API keys are usually 32 chars
            print("Could not find API key on account page. Page content might have changed.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    get_shodan_api_key()
