import { Suspense } from 'react';
import SearchInterface from '@/components/SearchInterface';

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
    // Try to load from the generated metadata file
    const response = await fetch('/pdb-summary.json');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch {
    console.log('Using sample data - run metadata script to get full dataset');
  }
  
  // Fallback to sample data
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
