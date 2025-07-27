const fs = require('fs');
const path = require('path');

// PDB REST API endpoints
const PDB_SEARCH_API = 'https://search.rcsb.org/rcsbsearch/v2/query';
const PDB_DATA_API = 'https://data.rcsb.org/rest/v1/core/entry';

/**
 * Fetch a batch of PDB entries with metadata
 */
async function fetchPDBBatch(start = 0, rows = 100) {
  // Simplified query that should work with current PDB API
  const query = {
    query: {
      type: "terminal",
      service: "text",
      parameters: {
        attribute: "exptl.method",
        operator: "in",
        value: ["X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "NMR"]
      }
    },
    request_options: {
      paginate: {
        start: start,
        rows: rows
      },
      sort: [
        {
          sort_by: "score",
          direction: "desc"
        }
      ]
    },
    return_type: "entry"
  };

  try {
    console.log(`Making API request to: ${PDB_SEARCH_API}`);
    console.log(`Query:`, JSON.stringify(query, null, 2));
    
    const response = await fetch(PDB_SEARCH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(query)
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Received ${data.result_set?.length || 0} results`);
    return data.result_set || [];
  } catch (error) {
    console.error('Error fetching PDB batch:', error);
    return [];
  }
}

/**
 * Fetch detailed metadata for a list of PDB IDs
 */
async function fetchDetailedMetadata(pdbIds) {
  const batchSize = 50; // API limit
  const results = [];

  for (let i = 0; i < pdbIds.length; i += batchSize) {
    const batch = pdbIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');
    
    try {
      console.log(`Fetching detailed metadata for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pdbIds.length/batchSize)}...`);
      
      const response = await fetch(`${PDB_DATA_API}/${idsParam}`);
      
      if (!response.ok) {
        console.warn(`Failed to fetch metadata for batch: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const batchResults = Array.isArray(data) ? data : [data];
      
      batchResults.forEach(entry => {
        if (entry && entry.rcsb_id) {
          const metadata = {
            pdb_id: entry.rcsb_id,
            protein_name: getProteinName(entry),
            organism: getOrganism(entry),
            resolution: entry.rcsb_entry_info?.resolution_combined?.[0] || null,
            method: entry.exptl?.[0]?.method || 'Unknown',
            release_date: entry.rcsb_accession_info?.initial_release_date || null,
            structure_title: entry.struct?.title || '',
            molecular_weight: entry.rcsb_entry_info?.molecular_weight || null,
            keywords: getKeywords(entry),
            classification: entry.struct_keywords?.pdbx_keywords || '',
            authors: getAuthors(entry)
          };
          results.push(metadata);
        }
      });

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching metadata for batch ${i}-${i+batchSize}:`, error);
    }
  }

  return results;
}

/**
 * Extract protein name from entry data
 */
function getProteinName(entry) {
  // Try multiple sources for protein name
  if (entry.struct?.title) {
    return entry.struct.title.substring(0, 200); // Truncate long titles
  }
  
  if (entry.rcsb_primary_citation?.title) {
    return entry.rcsb_primary_citation.title.substring(0, 200);
  }
  
  if (entry.struct_keywords?.pdbx_keywords) {
    return entry.struct_keywords.pdbx_keywords.substring(0, 200);
  }
  
  return 'Unknown Protein';
}

/**
 * Extract organism information
 */
function getOrganism(entry) {
  if (entry.rcsb_entity_source_organism) {
    const organisms = entry.rcsb_entity_source_organism
      .map(org => org.ncbi_scientific_name || org.bto_name)
      .filter(Boolean)
      .slice(0, 3); // Limit to 3 organisms
    
    if (organisms.length > 0) {
      return organisms.join(', ');
    }
  }
  
  return 'Unknown';
}

/**
 * Extract keywords
 */
function getKeywords(entry) {
  const keywords = [];
  
  if (entry.struct_keywords?.pdbx_keywords) {
    keywords.push(...entry.struct_keywords.pdbx_keywords.split(',').map(k => k.trim()));
  }
  
  if (entry.rcsb_entry_info?.structure_determination_methodology) {
    keywords.push(entry.rcsb_entry_info.structure_determination_methodology);
  }
  
  return keywords.slice(0, 10); // Limit keywords
}

/**
 * Extract authors
 */
function getAuthors(entry) {
  if (entry.rcsb_primary_citation?.rcsb_authors) {
    return entry.rcsb_primary_citation.rcsb_authors.slice(0, 5); // Limit to 5 authors
  }
  return [];
}

/**
 * Main function to fetch and save PDB metadata
 */
async function fetchPDBMetadata(targetCount = 5000) {
  console.log(`Starting to fetch metadata for ~${targetCount} PDB entries...`);
  
  const allPdbIds = [];
  const batchSize = 100;
  let start = 0;
  
  // Fetch PDB IDs in batches
  while (allPdbIds.length < targetCount) {
    console.log(`Fetching PDB IDs batch ${Math.floor(start/batchSize) + 1}...`);
    
    const batch = await fetchPDBBatch(start, batchSize);
    
    if (batch.length === 0) {
      console.log('No more results available');
      break;
    }
    
    const pdbIds = batch.map(entry => entry.identifier);
    allPdbIds.push(...pdbIds);
    
    start += batchSize;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`Found ${allPdbIds.length} PDB IDs. Fetching detailed metadata...`);
  
  // Fetch detailed metadata
  const metadata = await fetchDetailedMetadata(allPdbIds.slice(0, targetCount));
  
  // Save to file
  const outputPath = path.join(__dirname, '..', 'public', 'pdb-summary.json');
  
  // Ensure public directory exists
  const publicDir = path.dirname(outputPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
  
  console.log(`✅ Successfully saved ${metadata.length} PDB entries to ${outputPath}`);
  console.log(`📊 Sample entry:`, metadata[0]);
  
  return metadata;
}

// Run if called directly
if (require.main === module) {
  const targetCount = process.argv[2] ? parseInt(process.argv[2]) : 5000;
  
  fetchPDBMetadata(targetCount)
    .then(() => {
      console.log('✅ Metadata fetch completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error fetching metadata:', error);
      process.exit(1);
    });
}

module.exports = { fetchPDBMetadata };
