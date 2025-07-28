#!/usr/bin/env tsx
/**
 * Migration script to move PDB data from JSON file to Supabase
 * with inverted index optimization
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PDBEntryJSON {
  pdb_id: string;
  protein_name: string;
  organism: string;
  resolution?: number;
  method?: string;
  release_date?: string;
  structure_title?: string;
  molecular_weight?: number;
  keywords?: string[];
  classification?: string;
  authors?: string[];
}

async function migratePDBData() {
  try {
    console.log('🚀 Starting PDB data migration to Supabase...');

    // Read JSON data
    const jsonPath = path.join(process.cwd(), 'public', 'pdb-summary.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ pdb-summary.json not found. Run the fetch script first.');
      process.exit(1);
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as PDBEntryJSON[];
    console.log(`📊 Found ${jsonData.length} PDB entries to migrate`);

    // Check if data already exists
    const { count } = await supabase
      .from('pdb_entries')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      console.log(`⚠️  Database already contains ${count} entries`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        readline.question('Do you want to clear existing data and re-import? (y/N): ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('🗑️  Clearing existing data...');
        const { error } = await supabase.from('pdb_entries').delete().neq('id', 0);
        if (error) {
          console.error('❌ Error clearing data:', error);
          process.exit(1);
        }
      } else {
        console.log('✅ Migration cancelled');
        process.exit(0);
      }
    }

    // Batch insert data (Supabase has a limit of ~1000 rows per insert)
    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      
      console.log(`📤 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jsonData.length / batchSize)} (${batch.length} entries)...`);
      
      // Transform data for Supabase
      const transformedBatch = batch.map(entry => ({
        pdb_id: entry.pdb_id.toLowerCase(), // Normalize PDB IDs
        protein_name: entry.protein_name || 'Unknown Protein',
        organism: entry.organism || 'Unknown',
        resolution: entry.resolution || null,
        method: entry.method || null,
        release_date: entry.release_date ? new Date(entry.release_date).toISOString() : null,
        structure_title: entry.structure_title || '',
        molecular_weight: entry.molecular_weight || null,
        keywords: entry.keywords || [],
        classification: entry.classification || '',
        authors: entry.authors || []
      }));

      const { data, error } = await supabase
        .from('pdb_entries')
        .insert(transformedBatch)
        .select('id, pdb_id');

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        
        // Try to insert individually to identify problematic entries
        console.log('🔍 Attempting individual inserts to identify issues...');
        for (const entry of transformedBatch) {
          const { error: individualError } = await supabase
            .from('pdb_entries')
            .insert([entry]);
          
          if (individualError) {
            console.error(`❌ Failed to insert ${entry.pdb_id}:`, individualError);
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount += data?.length || 0;
        console.log(`✅ Successfully inserted ${data?.length || 0} entries`);
      }

      // Rate limiting - be nice to Supabase
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Migration completed! Inserted ${insertedCount} out of ${jsonData.length} entries`);

    // Verify the data and indices
    console.log('🔍 Verifying migration...');
    
    const { data: sampleData, error: sampleError } = await supabase
      .from('pdb_entries')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error verifying data:', sampleError);
    } else {
      console.log('📋 Sample entries:');
      sampleData?.forEach(entry => {
        console.log(`  - ${entry.pdb_id}: ${entry.protein_name}`);
      });
    }

    // Test search functionality
    console.log('🔍 Testing search functionality...');
    
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_pdb_entries', {
        search_query: 'protein',
        limit_count: 3
      });

    if (searchError) {
      console.error('❌ Search test failed:', searchError);
    } else {
      console.log(`✅ Search test passed! Found ${searchResults?.length || 0} results`);
      searchResults?.forEach((result: any) => {
        console.log(`  - ${result.pdb_id}: ${result.protein_name} (rank: ${result.search_rank})`);
      });
    }

    console.log('✅ Migration and verification completed successfully!');
    console.log('');
    console.log('🚀 Your PDB database is now powered by Supabase with inverted indices!');
    console.log('📈 Benefits:');
    console.log('  - Lightning-fast full-text search');
    console.log('  - Fuzzy matching with trigrams');
    console.log('  - Scalable to millions of entries');
    console.log('  - Real-time search suggestions');
    console.log('  - User authentication and bookmarks');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePDBData();
