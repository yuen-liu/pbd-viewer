#!/usr/bin/env python3
"""
Fetch PDB metadata using Python
More reliable than the Node.js version with better error handling
"""

import requests
import json
import time
import sys
from pathlib import Path

# PDB REST API endpoints
PDB_SEARCH_API = 'https://search.rcsb.org/rcsbsearch/v2/query'
PDB_DATA_API = 'https://data.rcsb.org/rest/v1/core/entry'

def fetch_pdb_batch(start=0, rows=100):
    """Fetch a batch of PDB entries"""
    query = {
        "query": {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "exptl.method",
                "operator": "in",
                "value": ["X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "NMR"]
            }
        },
        "request_options": {
            "paginate": {
                "start": start,
                "rows": rows
            },
            "sort": [
                {
                    "sort_by": "score",
                    "direction": "desc"
                }
            ]
        },
        "return_type": "entry"
    }
    
    try:
        print(f"Making API request to: {PDB_SEARCH_API}")
        response = requests.post(
            PDB_SEARCH_API,
            json=query,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            result_set = data.get('result_set', [])
            # Extract PDB IDs from the result set
            pdb_ids = []
            for item in result_set:
                if isinstance(item, dict) and 'identifier' in item:
                    pdb_ids.append(item['identifier'])
                elif isinstance(item, str):
                    pdb_ids.append(item)
            print(f"Received {len(pdb_ids)} PDB IDs")
            return pdb_ids
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
            
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return []

def fetch_detailed_metadata(pdb_ids):
    """Fetch detailed metadata for PDB IDs one by one"""
    results = []
    
    for i, pdb_id in enumerate(pdb_ids):
        try:
            print(f"Fetching detailed metadata for {pdb_id} ({i+1}/{len(pdb_ids)})...")
            
            url = f"{PDB_DATA_API}/{pdb_id}"
            
            response = requests.get(
                url,
                headers={'Accept': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                entry = response.json()
                
                if entry and entry.get('rcsb_id'):
                    metadata = extract_metadata(entry)
                    if metadata:
                        results.append(metadata)
                        print(f"✓ Successfully processed {pdb_id}")
                    else:
                        print(f"✗ Failed to extract metadata for {pdb_id}")
                else:
                    print(f"✗ Invalid entry data for {pdb_id}")
                
            else:
                print(f"✗ Failed to fetch {pdb_id}: {response.status_code} - {response.text[:100]}")
                
            # Rate limiting - be nice to the API
            time.sleep(0.2)
            
        except requests.exceptions.RequestException as e:
            print(f"✗ Request error for {pdb_id}: {e}")
        except json.JSONDecodeError as e:
            print(f"✗ JSON decode error for {pdb_id}: {e}")
    
    return results

def extract_metadata(entry):
    """Extract metadata from PDB entry"""
    try:
        # Get protein name
        protein_name = "Unknown Protein"
        if entry.get('struct', {}).get('title'):
            protein_name = entry['struct']['title']
        elif entry.get('rcsb_primary_citation', {}).get('title'):
            protein_name = entry['rcsb_primary_citation']['title']
        
        # Get organism
        organism = "Unknown"
        if entry.get('rcsb_entity_source_organism'):
            organisms = entry['rcsb_entity_source_organism']
            if organisms and len(organisms) > 0:
                organism = organisms[0].get('ncbi_scientific_name', 'Unknown')
        
        # Get keywords
        keywords = []
        if entry.get('struct_keywords', {}).get('pdbx_keywords'):
            keywords = [kw.strip() for kw in entry['struct_keywords']['pdbx_keywords'].split(',')]
        
        # Get authors
        authors = []
        if entry.get('audit_author'):
            authors = [author.get('name', '') for author in entry['audit_author']]
        
        metadata = {
            'pdb_id': entry['rcsb_id'],
            'protein_name': protein_name,
            'organism': organism,
            'resolution': entry.get('rcsb_entry_info', {}).get('resolution_combined', [None])[0],
            'method': entry.get('exptl', [{}])[0].get('method', 'Unknown'),
            'release_date': entry.get('rcsb_accession_info', {}).get('initial_release_date'),
            'structure_title': entry.get('struct', {}).get('title', ''),
            'molecular_weight': entry.get('rcsb_entry_info', {}).get('molecular_weight'),
            'keywords': keywords,
            'classification': entry.get('struct_keywords', {}).get('pdbx_keywords', ''),
            'authors': authors
        }
        
        return metadata
        
    except Exception as e:
        print(f"Error extracting metadata for {entry.get('rcsb_id', 'unknown')}: {e}")
        return None

def main():
    target_count = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    
    print(f"Starting to fetch metadata for ~{target_count} PDB entries...")
    
    # Fetch PDB IDs
    all_pdb_ids = []
    batch_size = 100
    
    for start in range(0, target_count, batch_size):
        rows = min(batch_size, target_count - start)
        print(f"Fetching PDB IDs batch {start//batch_size + 1}...")
        
        batch_ids = fetch_pdb_batch(start, rows)
        if not batch_ids:
            print("No more results available")
            break
            
        all_pdb_ids.extend(batch_ids)
        
        if len(all_pdb_ids) >= target_count:
            all_pdb_ids = all_pdb_ids[:target_count]
            break
    
    print(f"Found {len(all_pdb_ids)} PDB IDs. Fetching detailed metadata...")
    
    # Fetch detailed metadata
    metadata_results = fetch_detailed_metadata(all_pdb_ids)
    
    # Save results
    output_path = Path(__file__).parent.parent / 'public' / 'pdb-summary.json'
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(metadata_results, f, indent=2)
    
    print(f"✅ Successfully saved {len(metadata_results)} PDB entries to {output_path}")
    
    if metadata_results:
        print(f"📊 Sample entry: {metadata_results[0]['pdb_id']} - {metadata_results[0]['protein_name']}")
    
    print("✅ Metadata fetch completed successfully!")

if __name__ == "__main__":
    main()
