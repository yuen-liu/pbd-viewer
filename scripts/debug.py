#!/usr/bin/env python3
"""
Fixed PDB organism extraction - corrected GraphQL query and REST API approach
"""

import requests
import json
import time

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
    print(f"Trying corrected GraphQL for {pdb_id}...")
    
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
            'https://data.rcsb.org/graphql',
            json={'query': query, 'variables': {'pdb_id': pdb_id}},
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for errors
            if 'errors' in data:
                print(f"GraphQL errors: {data['errors']}")
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
                                        print(f"✓ Found organism via GraphQL: {organism}")
                                        return organism.strip()
                            
    except Exception as e:
        print(f"GraphQL error for {pdb_id}: {e}")
    
    return "Unknown"

def try_rest_entities(pdb_id):
    """Try REST API for polymer entities with correct endpoints"""
    print(f"Trying REST entities for {pdb_id}...")
    
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
                                print(f"✓ Found organism via REST entities: {organism}")
                                return organism.strip()
                    
    except Exception as e:
        print(f"REST entities error for {pdb_id}: {e}")
    
    return "Unknown"

def try_entry_rest(pdb_id):
    """Try entry-level REST API for organism info"""
    print(f"Trying entry REST for {pdb_id}...")
    
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
                        print(f"✓ Found organism via entry REST: {organism}")
                        return organism.strip()
                        
    except Exception as e:
        print(f"Entry REST error for {pdb_id}: {e}")
    
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

def test_organism_extraction():
    """Test the corrected organism extraction"""
    test_pdbs = ["1HHO", "1CRN", "6LU7", "1IGY", "2LYZ"]  # Known PDB IDs
    
    for pdb_id in test_pdbs:
        print(f"\n=== Testing {pdb_id} ===")
        organism = get_organism_corrected(pdb_id)
        print(f"Final result for {pdb_id}: {organism}")
        print("-" * 50)
        time.sleep(1)

# Updated function for your main script
def fetch_detailed_metadata_fixed(pdb_ids):
    """Updated fetch function with corrected organism extraction"""
    results = []
    
    for i, pdb_id in enumerate(pdb_ids):
        try:
            print(f"Fetching detailed metadata for {pdb_id} ({i+1}/{len(pdb_ids)})...")
            
            # Fetch entry-level data
            entry_url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
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
                metadata = extract_metadata_fixed(entry, organism)
                if metadata:
                    results.append(metadata)
                    print(f"✓ Successfully processed {pdb_id} - Organism: {organism}")
                else:
                    print(f"✗ Failed to extract metadata for {pdb_id}")
            else:
                print(f"✗ Invalid entry data for {pdb_id}")
                
            # Rate limiting
            time.sleep(0.3)
            
        except Exception as e:
            print(f"✗ Error for {pdb_id}: {e}")
    
    return results

def extract_metadata_fixed(entry, organism):
    """Extract metadata with corrected organism"""
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

if __name__ == "__main__":
    test_organism_extraction()