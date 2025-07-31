/**
 * Search Page Component
 * 
 * This page provides the main interface for searching and browsing PDB entries.
 * It handles data loading from multiple sources with fallbacks:
 * 1. Primary: Supabase database
 * 2. Fallback 1: Local JSON file
 * 3. Fallback 2: Sample hardcoded data
 * 
 * Features:
 * - Server-side data loading with Suspense for better UX
 * - Graceful degradation if database is unavailable
 * - Loading states and error handling
 */

import { Suspense } from 'react';
import fs from 'fs';
import path from 'path';

// Local imports
import SearchInterface from '@/components/SearchInterface';
import { pdbService } from '@/lib/supabase';

/**
 * Sample PDB Data
 * 
 * Hardcoded sample data used as a fallback when:
 * 1. Supabase is not available
 * 2. Local JSON file cannot be loaded
 * 
 * @type {Array<import('@/components/SearchInterface').PDBEntry>}
 */
const samplePDBData = [
  {
    pdb_id: '1crn',
    protein_name: 'Crambin',
    organism: 'Crambe abyssinica',
    resolution: 1.5,
    method: 'X-RAY DIFFRACTION',
    release_date: '1981-04-30',
    structure_title: 'Crambin',
    molecular_weight: 4730,
    keywords: ['plant protein', 'hydrophobic protein'],
    classification: 'PLANT PROTEIN',
    authors: ['Teeter, M.M.']
  },
  // ... rest of the sample data
];

/**
 * Loads PDB data with fallback mechanisms
 * 
 * Data loading strategy:
 * 1. Try to load from Supabase (production)
 * 2. Fall back to local JSON file (development)
 * 3. Fall back to hardcoded sample data (last resort)
 * 
 * @returns {Promise<Array<import('@/components/SearchInterface').PDBEntry>>} Array of PDB entries
 */
async function loadPDBData() {
  try {
    // Try to load from Supabase first
    console.log('Loading PDB data from Supabase...');
    const supabaseData = await pdbService.getPDBEntries(undefined, 1000);
    
    if (supabaseData && supabaseData.length > 0) {
      console.log(`✅ Loaded ${supabaseData.length} PDB entries from Supabase`);
      return supabaseData;
    }
    
    console.log('No data in Supabase, trying local file...');
    
    // Fallback to local JSON file
    const filePath = path.join(process.cwd(), 'public', 'pdb-summary.json');
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContents);
      if (data && data.length > 0) {
        console.log(`📁 Loaded ${data.length} PDB entries from local file`);
        return data;
      }
    }
  } catch (error) {
    console.log('Error loading from Supabase:', error);
    console.log('Falling back to local data...');
    
    // Try local file as backup
    try {
      const filePath = path.join(process.cwd(), 'public', 'pdb-summary.json');
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContents);
        if (data && data.length > 0) {
          console.log(`📁 Loaded ${data.length} PDB entries from local file (fallback)`);
          return data;
        }
      }
    } catch (localError) {
      console.log('Error loading local file:', localError);
    }
  }
  
  console.log('⚠️  Using sample data - run migration script to populate Supabase');
  // Final fallback to sample data
  return samplePDBData;
}

/**
 * Search Page Component
 * 
 * This is a Server Component that:
 * - Loads PDB data on the server
 * - Passes data to the SearchInterface client component
 * - Handles loading states with Suspense
 * - Implements error boundaries
 */
export default async function SearchPage() {
  const pdbData = await loadPDBData();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <SearchInterface pdbData={pdbData} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
