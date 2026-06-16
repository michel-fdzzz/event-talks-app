import os
import re
import json
import urllib.request
import xml.etree.ElementTree as ET
import hashlib
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'release_notes_cache.json')
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def strip_tags(html):
    """
    Strips HTML tags to extract plain text and decodes common HTML entities.
    """
    if not html:
        return ""
    # Replace block elements with spacing
    text = re.sub(r'</?(p|li|h3|h4|div|ul|ol|br)[^>]*>', '\n', html)
    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode basic HTML entities
    text = (text.replace('&amp;', '&')
                .replace('&lt;', '<')
                .replace('&gt;', '>')
                .replace('&#39;', "'")
                .replace('&quot;', '"')
                .replace('&nbsp;', ' '))
    # Normalize whitespace and filter out empty lines
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join([l for l in lines if l])

def generate_id(date_str, item_type, plain_text):
    """
    Generates a unique, stable ID for a specific release note item.
    """
    hash_input = f"{date_str}_{item_type}_{plain_text[:100]}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()

def parse_entry_content(content_html):
    """
    Parses the HTML content of a feed entry, splitting it by <h3> tags
    which represent individual update items (Feature, Change, Issue, etc.).
    """
    if not content_html:
        return []
        
    if '<h3>' not in content_html:
        plain = strip_tags(content_html)
        return [{
            'type': 'Update',
            'description': content_html,
            'plain_text': plain
        }]
        
    items = []
    # Split content by <h3> to separate different release notes for the same date
    chunks = re.split(r'<h3>', content_html)
    
    # Check if there is text before the first <h3> tag
    first_chunk = chunks[0].strip()
    if first_chunk:
        items.append({
            'type': 'Update',
            'description': first_chunk,
            'plain_text': strip_tags(first_chunk)
        })
        
    for chunk in chunks[1:]:
        parts = chunk.split('</h3>', 1)
        if len(parts) == 2:
            item_type = parts[0].strip()
            item_desc = parts[1].strip()
            items.append({
                'type': item_type,
                'description': item_desc,
                'plain_text': strip_tags(item_desc)
            })
        else:
            items.append({
                'type': 'Update',
                'description': chunk,
                'plain_text': strip_tags(chunk)
            })
            
    return items

def fetch_and_parse_feed():
    """
    Fetches the XML feed from Google, parses the XML entries,
    and returns a structured list of individual release items.
    """
    req = urllib.request.Request(
        FEED_URL,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
    except Exception as e:
        raise Exception(f"Failed to download release notes: {str(e)}")
        
    try:
        # Parse XML
        root = ET.fromstring(xml_data)
        # Atom feed namespace
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        
        all_release_items = []
        
        for entry in root.findall('atom:entry', namespaces):
            # Parse date and base fields
            title_elem = entry.find('atom:title', namespaces)
            date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
            
            updated_elem = entry.find('atom:updated', namespaces)
            updated_time = updated_elem.text.strip() if updated_elem is not None else ""
            
            link_elem = entry.find('atom:link', namespaces)
            link_url = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', namespaces)
            content_html = content_elem.text if content_elem is not None else ""
            
            # Extract individual items (an entry may have multiple <h3> items)
            parsed_items = parse_entry_content(content_html)
            
            for item in parsed_items:
                item_type = item['type']
                desc_html = item['description']
                plain_txt = item['plain_text']
                
                unique_id = generate_id(date_str, item_type, plain_txt)
                
                all_release_items.append({
                    'id': unique_id,
                    'date': date_str,
                    'updated': updated_time,
                    'link': link_url,
                    'type': item_type,
                    'description': desc_html,
                    'plain_text': plain_txt
                })
                
        return all_release_items
        
    except Exception as e:
        raise Exception(f"Failed to parse XML: {str(e)}")

def get_releases(force_refresh=False):
    """
    Returns the release notes. Uses local cache unless force_refresh is True
    or the cache file does not exist.
    """
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f), "cache"
        except Exception:
            pass # fallback to live load if cache reading fails
            
    # Fetch live data
    releases = fetch_and_parse_feed()
    
    # Save cache
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(releases, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Warning: Could not save cache file: {e}")
        
    return releases, "live"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, source = get_releases(force_refresh=refresh)
        return jsonify({
            'success': True,
            'source': source,
            'count': len(releases),
            'releases': releases
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Bind to localhost:5000
    app.run(debug=True, port=5000)
