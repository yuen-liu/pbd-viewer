import { Suspense } from 'react';
import SearchInterface from '@/components/SearchInterface';
import { pdbService } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Sample PDB data for development - replace with actual data loading
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
  {
    pdb_id: '1ubq',
    protein_name: 'Ubiquitin',
    organism: 'Homo sapiens',
    resolution: 1.8,
    method: 'X-RAY DIFFRACTION',
    release_date: '1988-01-18',
    structure_title: 'Ubiquitin',
    molecular_weight: 8560,
    keywords: ['protein degradation', 'signaling protein'],
    classification: 'SIGNALING PROTEIN',
    authors: ['Vijay-Kumar, S.', 'Bugg, C.E.', 'Cook, W.J.']
  },
  {
    pdb_id: '2hbb',
    protein_name: 'Hemoglobin',
    organism: 'Homo sapiens',
    resolution: 2.1,
    method: 'X-RAY DIFFRACTION',
    release_date: '1984-03-07',
    structure_title: 'Human Deoxyhemoglobin',
    molecular_weight: 64500,
    keywords: ['oxygen transport', 'heme protein'],
    classification: 'OXYGEN TRANSPORT',
    authors: ['Fermi, G.', 'Perutz, M.F.']
  }
];

async function loadPDBData() {
  try {
    // Try to load from Supabase first
    console.log('Loading PDB data from Supabase...');
    const supabaseData = await pdbService.getPDBEntries(undefined, 1000); // Get up to 1000 entries
    
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

export default async function Home() {
  const pdbData = await loadPDBData();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-8">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading PDB database...</p>
            </div>
          </div>
        }>
          <SearchInterface pdbData={pdbData} />
        </Suspense>
      </div>
    </div>
  );
}
