#!/usr/bin/env python3
"""
Fetch PDB metadata using Python
Fixed version with working organism extraction
"""

import requests
import json
import time
import sys
from pathlib import Path

# PDB REST API endpoints
PDB_SEARCH_API = 'https://search.rcsb.org/rcsbsearch/v2/query'
PDB_DATA_API = 'https://data.rcsb.org/rest/v1/core/entry'
PDB_GRAPHQL_API = 'https://data.rcsb.org/graphql'

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

def get_organism_corrected(pdb_id):
    """Get organism using multiple corrected approaches"""
    
    # Method 1: Try GraphQL with correct field names
    organism = try_corrected_graphql(pdb_id)
    if organism != "Unknown":
        return organism
    
    # Method 2: Try REST API with correct entity endpoints
    organism = try_rest_entities(pdb_id)
    if organism != "Unknown":
        return organism
    
    # Method 3: Try entry-level REST API for source organism info
    organism = try_entry_rest(pdb_id)
    if organism != "Unknown":
        return organism
    
    return "Unknown"

def try_corrected_graphql(pdb_id):
    """Try GraphQL with corrected field names"""
    
    # Corrected GraphQL query without invalid fields
    query = """
    query($pdb_id: String!) {
      entry(entry_id: $pdb_id) {
        polymer_entities {
          rcsb_entity_source_organism {
            ncbi_scientific_name
            scientific_name
          }
          entity_src_gen {
            pdbx_host_org_scientific_name
          }
          entity_src_nat {
            pdbx_organism_scientific
          }
          rcsb_entity_host_organism {
            ncbi_scientific_name
            scientific_name
          }
        }
      }
    }
    """
    
    try:
        response = requests.post(
            PDB_GRAPHQL_API,
            json={'query': query, 'variables': {'pdb_id': pdb_id}},
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for errors
            if 'errors' in data:
                return "Unknown"
            
            if 'data' in data and data['data'] and data['data']['entry']:
                entities = data['data']['entry']['polymer_entities']
                
                if entities:
                    for entity in entities:
                        # Try different organism sources in priority order
                        organism_sources = [
                            ('rcsb_entity_source_organism', 'ncbi_scientific_name'),
                            ('rcsb_entity_source_organism', 'scientific_name'),
                            ('entity_src_nat', 'pdbx_organism_scientific'),
                            ('entity_src_gen', 'pdbx_host_org_scientific_name'),
                            ('rcsb_entity_host_organism', 'ncbi_scientific_name'),
                            ('rcsb_entity_host_organism', 'scientific_name'),
                        ]
                        
                        for source_key, name_key in organism_sources:
                            if source_key in entity and entity[source_key]:
                                source_data = entity[source_key]
                                if isinstance(source_data, list) and len(source_data) > 0:
                                    source_data = source_data[0]
                                
                                if isinstance(source_data, dict) and name_key in source_data:
                                    organism = source_data[name_key]
                                    if organism and organism.strip() and not organism.lower().startswith('j '):  # Avoid journal names
                                        return organism.strip()
                            
    except Exception as e:
        pass  # Silent fallback to other methods
    
    return "Unknown"

def try_rest_entities(pdb_id):
    """Try REST API for polymer entities with correct endpoints"""
    
    # Try the polymer entities endpoint
    try:
        url = f"https://data.rcsb.org/rest/v1/core/polymer_entities/{pdb_id}"
        response = requests.get(url, headers={'Accept': 'application/json'}, timeout=30)
        
        if response.status_code == 200:
            entities = response.json()
            
            # Handle both single entity and multiple entities
            if not isinstance(entities, list):
                entities = [entities]
            
            for entity in entities:
                if isinstance(entity, dict):
                    # Look for organism in various fields
                    organism_paths = [
                        ['rcsb_entity_source_organism', 0, 'ncbi_scientific_name'],
                        ['rcsb_entity_source_organism', 0, 'scientific_name'],
                        ['entity_src_gen', 0, 'pdbx_host_org_scientific_name'],
                        ['entity_src_nat', 0, 'pdbx_organism_scientific'],
                        ['rcsb_entity_host_organism', 0, 'ncbi_scientific_name'],
                    ]
                    
                    for path in organism_paths:
                        organism = get_nested_value(entity, path)
                        if organism and isinstance(organism, str) and organism.strip():
                            # Make sure it's not a journal name
                            if not any(journal in organism.lower() for journal in ['j mol', 'nature', 'science', 'proc natl']):
                                return organism.strip()
                    
    except Exception as e:
        pass  # Silent fallback
    
    return "Unknown"

def try_entry_rest(pdb_id):
    """Try entry-level REST API for organism info"""
    
    try:
        url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
        response = requests.get(url, headers={'Accept': 'application/json'}, timeout=30)
        
        if response.status_code == 200:
            entry = response.json()
            
            # Look for organism in entry-level fields
            organism_paths = [
                ['rcsb_entry_info', 'source_organism_names', 0],
                ['rcsb_entry_info', 'polymer_composition', 'source_organism_names', 0],
            ]
            
            for path in organism_paths:
                organism = get_nested_value(entry, path)
                if organism and isinstance(organism, str) and organism.strip():
                    # Make sure it's not a journal name
                    if not any(journal in organism.lower() for journal in ['j mol', 'nature', 'science', 'proc natl']):
                        return organism.strip()
                        
    except Exception as e:
        pass  # Silent fallback
    
    return "Unknown"

def get_nested_value(data, path):
    """Safely get nested value from dict/list structure"""
    current = data
    try:
        for key in path:
            if isinstance(key, int):
                if isinstance(current, list) and len(current) > key:
                    current = current[key]
                else:
                    return None
            else:
                if isinstance(current, dict) and key in current:
                    current = current[key]
                else:
                    return None
        return current
    except (KeyError, IndexError, TypeError):
        return None

def fetch_detailed_metadata(pdb_ids):
    """Fetch detailed metadata for PDB IDs one by one"""
    results = []
    
    for i, pdb_id in enumerate(pdb_ids):
        try:
            print(f"Fetching detailed metadata for {pdb_id} ({i+1}/{len(pdb_ids)})...")
            
            # Fetch entry-level data
            entry_url = f"{PDB_DATA_API}/{pdb_id}"
            entry_response = requests.get(
                entry_url,
                headers={'Accept': 'application/json'},
                timeout=30
            )
            
            if entry_response.status_code != 200:
                print(f"✗ Failed to fetch entry data for {pdb_id}")
                continue
                
            entry = entry_response.json()
            
            # Get organism using corrected method
            organism = get_organism_corrected(pdb_id)
            
            if entry and entry.get('rcsb_id'):
                metadata = extract_metadata(entry, organism)
                if metadata:
                    results.append(metadata)
                    print(f"✓ Successfully processed {pdb_id} - Organism: {organism}")
                else:
                    print(f"✗ Failed to extract metadata for {pdb_id}")
            else:
                print(f"✗ Invalid entry data for {pdb_id}")
                
            # Rate limiting - be nice to the API
            time.sleep(0.3)
            
        except requests.exceptions.RequestException as e:
            print(f"✗ Request error for {pdb_id}: {e}")
        except json.JSONDecodeError as e:
            print(f"✗ JSON decode error for {pdb_id}: {e}")
    
    return results

def extract_metadata(entry, organism):
    """Extract metadata from PDB entry"""
    try:
        # Get protein name
        protein_name = "Unknown Protein"
        if entry.get('struct', {}).get('title'):
            protein_name = entry['struct']['title']
        elif entry.get('rcsb_primary_citation', {}).get('title'):
            protein_name = entry['rcsb_primary_citation']['title']
        
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
            'organism': organism,  # Use the corrected organism
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
    target_count = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    
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
        print(f"📊 Sample entry: {metadata_results[0]['pdb_id']} - {metadata_results[0]['protein_name']} - {metadata_results[0]['organism']}")
    
    print("✅ Metadata fetch completed successfully!")

if __name__ == "__main__":
    main()