'use client';

import React, { useEffect, useRef, useState } from 'react';

// Type definitions for 3Dmol
declare global {
  interface Window {
    $3Dmol: any;
  }
}

interface ViewerProps {
  pdbId: string;
  onClose?: () => void;
}

export const Viewer: React.FC<ViewerProps> = ({ pdbId, onClose }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<'cartoon' | 'stick' | 'sphere'>('cartoon');
  const [showLigands, setShowLigands] = useState(true);
  const [colorMode, setColorMode] = useState<'chain' | 'default'>('chain');
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    // Load 3Dmol.js script if not already loaded
    if (!window.$3Dmol) {
      const script = document.createElement('script');
      script.src = 'https://3Dmol.org/build/3Dmol-min.js';
      script.onload = () => initializeViewer();
      script.onerror = () => setError('Failed to load 3Dmol.js');
      document.head.appendChild(script);
    } else {
      initializeViewer();
    }

    return () => {
      if (viewer) {
        viewer.clear();
      }
    };
  }, [pdbId]);

  // Apply styles whenever settings change
  useEffect(() => {
    if (viewer && !loading && !error) {
      setTimeout(() => {
        applyStyle(viewer, currentStyle, showLigands);
      }, 100);
    }
  }, [viewer, currentStyle, colorMode, showLigands, showLabels, loading, error]);

  const initializeViewer = async () => {
    if (!viewerRef.current || !window.$3Dmol) return;

    try {
      setLoading(true);
      setError(null);

      // Create viewer
      const newViewer = window.$3Dmol.createViewer(viewerRef.current, {
        defaultcolors: window.$3Dmol.rasmolElementColors
      });

      // Fetch PDB data
      const response = await fetch(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB file: ${response.statusText}`);
      }
      
      const pdbData = await response.text();
      
      // Add model to viewer
      newViewer.addModel(pdbData, 'pdb');
      
      // Set view and render
      newViewer.zoomTo({}, 1.0);  // add margin
      newViewer.render();
            
      setViewer(newViewer);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDB structure:', err);
      setError(err instanceof Error ? err.message : 'Failed to load protein structure');
      setLoading(false);
    }
  };

  const applyStyle = (viewerInstance: any, style: string, showLigs: boolean) => {
    console.log('Applying style:', style, 'colorMode:', colorMode, 'showLigs:', showLigs, 'showLabels:', showLabels);
    
    try {
      viewerInstance.setStyle({}, {}); // Clear existing styles
      viewerInstance.removeAllLabels(); // Clear existing labels
      
      // Helper function to get available styles for the model
      const getAvailableStyles = (model: any) => {
        const styles = new Set<string>();
        const atoms = model?.selectedAtoms({}) || [];
        
        // Check which styles are available
        if (atoms.some((a: any) => a.ss === 'h' || a.ss === 's' || a.ss === '')) {
          styles.add('cartoon');
        }
        if (atoms.some((a: any) => a.bonds?.length > 0)) {
          styles.add('stick');
        }
        styles.add('sphere'); // Always available as a fallback
        
        return styles;
      };
      
      // Get model and available styles
      const model = viewerInstance.getModel(0);
      const availableStyles = getAvailableStyles(model);
      
      // If requested style isn't available, find the best fallback
      let effectiveStyle = style;
      if (!availableStyles.has(style)) {
        const stylePreference = ['cartoon', 'stick', 'sphere'];
        effectiveStyle = stylePreference.find(s => availableStyles.has(s)) || 'sphere';
        console.log(`Style '${style}' not available, falling back to '${effectiveStyle}'`);
      }
      
      if (colorMode === 'chain') {
        // Color each chain differently
        const chainColors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
          '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
          '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
        ];
        
        // Get all chains in the model
        const model = viewerInstance.getModel(0);
        if (model) {
          const atoms = model.selectedAtoms({});
          const chains = new Set<string>();
          const chainCenters: { [key: string]: { x: number, y: number, z: number, count: number } } = {};
          
          // Collect chains and calculate centers
          atoms.forEach((atom: any) => {
            if (atom.chain && !atom.hetflag) {
              chains.add(atom.chain);
              if (!chainCenters[atom.chain]) {
                chainCenters[atom.chain] = { x: 0, y: 0, z: 0, count: 0 };
              }
              chainCenters[atom.chain].x += atom.x;
              chainCenters[atom.chain].y += atom.y;
              chainCenters[atom.chain].z += atom.z;
              chainCenters[atom.chain].count++;
            }
          });
          
          // Apply different colors to each chain and add labels
          Array.from(chains).forEach((chainId: string, index: number) => {
            const chainColor = chainColors[index % chainColors.length];
            const styleConfig: any = {};
            
            // Apply the effective style
            styleConfig[effectiveStyle] = { color: chainColor };
            
            // Apply style to this specific chain (protein atoms only)
            viewerInstance.setStyle({ chain: chainId, hetflag: false }, styleConfig);
            
            // Add chain label if enabled
            if (showLabels && chainCenters[chainId]) {
              const center = chainCenters[chainId];
              const avgPos = {
                x: center.x / center.count,
                y: center.y / center.count,
                z: center.z / center.count
              };
              
              viewerInstance.addLabel(`Chain ${chainId}`, {
                position: avgPos,
                backgroundColor: chainColor,
                backgroundOpacity: 0.8,
                fontColor: 'white',
                fontSize: 12,
                fontFamily: 'Arial',
                borderThickness: 2,
                borderColor: 'white',
                borderOpacity: 0.8
              });
            }
          });
        }
      } else if (colorMode === 'default') {
        // Default color mode - apply to all protein atoms
        const styleConfig: any = {
          [effectiveStyle]: { colorscheme: 'default' }
        };
        
        // Special case for cartoon style
        if (effectiveStyle === 'cartoon') {
          styleConfig.cartoon = { 
            color: 'spectrum',
            colorscheme: 'rainbow'
          };
        }
        
        viewerInstance.setStyle({ hetflag: false }, styleConfig);
        
        // Add chain labels for default mode if enabled
        if (showLabels) {
          const model = viewerInstance.getModel(0);
          if (model) {
            const atoms = model.selectedAtoms({ hetflag: false });
            const chains = new Set<string>();
            const chainCenters: { [key: string]: { x: number, y: number, z: number, count: number } } = {};
            
            // Collect chains and calculate centers
            atoms.forEach((atom: any) => {
              if (atom.chain) {
                chains.add(atom.chain);
                if (!chainCenters[atom.chain]) {
                  chainCenters[atom.chain] = { x: 0, y: 0, z: 0, count: 0 };
                }
                chainCenters[atom.chain].x += atom.x;
                chainCenters[atom.chain].y += atom.y;
                chainCenters[atom.chain].z += atom.z;
                chainCenters[atom.chain].count++;
              }
            });
            
            // Add chain labels
            Array.from(chains).forEach((chainId: string) => {
              if (chainCenters[chainId]) {
                const center = chainCenters[chainId];
                const avgPos = {
                  x: center.x / center.count,
                  y: center.y / center.count,
                  z: center.z / center.count
                };
                
                viewerInstance.addLabel(`Chain ${chainId}`, {
                  position: avgPos,
                  backgroundColor: '#4A90E2',
                  backgroundOpacity: 0.8,
                  fontColor: 'white',
                  fontSize: 12,
                  fontFamily: 'Arial',
                  borderThickness: 2,
                  borderColor: 'white',
                  borderOpacity: 0.8
                });
              }
            });
          }
        }
      }
      
      // Handle ligands separately if showing them
      if (showLigs) {
        viewerInstance.setStyle({ hetflag: true }, { stick: { color: 'red', radius: 0.3 } });
        
        // Add ligand labels if enabled
        if (showLabels) {
          const model = viewerInstance.getModel(0);
          if (model) {
            const ligandAtoms = model.selectedAtoms({ hetflag: true });
            const ligandGroups: { [key: string]: any[] } = {};
            
            // Common molecules to exclude from labeling
            const excludedMolecules = new Set([
              'HOH', 'WAT', 'H2O', // Water
              'SO4', 'PO4', 'CL', 'NA', 'K', 'MG', 'CA', 'ZN', 'FE', // Common ions
              'ACE', 'NMA', 'FOR', 'EDO', 'GOL', 'PEG', // Common additives
              'TRS', 'BIS', 'HEPES', 'TRIS', // Buffer molecules
              'DMS', 'DMSO', 'MPD', 'PGE', 'BME' // Common solvents/additives
            ]);
            
            // Group ligand atoms by residue, excluding water and common molecules
            ligandAtoms.forEach((atom: any) => {
              if (atom.resn && !excludedMolecules.has(atom.resn.toUpperCase())) {
                const resKey = `${atom.resn}_${atom.resi}_${atom.chain}`;
                if (!ligandGroups[resKey]) {
                  ligandGroups[resKey] = [];
                }
                ligandGroups[resKey].push(atom);
              }
            });
            
            // Add labels for each ligand group
            Object.entries(ligandGroups).forEach(([resKey, atoms]) => {
              if (atoms.length > 0) {
                const centerX = atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length;
                const centerY = atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length;
                const centerZ = atoms.reduce((sum, atom) => sum + atom.z, 0) / atoms.length;
                
                viewerInstance.addLabel(atoms[0].resn, {
                  position: { x: centerX, y: centerY, z: centerZ },
                  backgroundColor: 'red',
                  backgroundOpacity: 0.8,
                  fontColor: 'white',
                  fontSize: 10,
                  fontFamily: 'Arial',
                  borderThickness: 1,
                  borderColor: 'white'
                });
              }
            });
          }
        }
      }
      
      viewerInstance.render();
      console.log('Style applied successfully');
    } catch (error) {
      console.error('Error applying style:', error);
    }
  };

  const handleStyleChange = (newStyle: 'cartoon' | 'stick' | 'sphere') => {
    console.log('Style changing to:', newStyle);
    setCurrentStyle(newStyle);
  };

  const handleColorModeChange = (newColorMode: 'chain' | 'default') => {
    console.log('Color mode changing to:', newColorMode);
    setColorMode(newColorMode);
  };

  const toggleLigands = () => {
    console.log('Toggling ligands, current:', showLigands);
    setShowLigands(prev => !prev);
  };

  const toggleLabels = () => {
    console.log('Toggling labels, current:', showLabels);
    setShowLabels(prev => !prev);
  };

  const downloadImage = () => {
    if (viewer) {
      const canvas = viewer.pngURI();
      const link = document.createElement('a');
      link.download = `${pdbId}_structure.png`;
      link.href = canvas;
      link.click();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Title Section - Two aligned rows */}
      <div className="px-4 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 text-center">
            <h3 className="text-xl font-bold text-gray-900">{pdbId.toUpperCase()}</h3>
          </div>
          {onClose && (
            <button 
              className="p-2 text-white bg-black hover:bg-gray-800 rounded-md transition-colors"
              onClick={onClose}
              title="Close viewer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center justify-center">
          <p className="text-sm text-gray-600">3D Structure</p>
        </div>
      </div>
      
      {/* Controls Section */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {/* Style dropdown */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Style</label>
            <select
              value={currentStyle}
              onChange={(e) => handleStyleChange(e.target.value as 'cartoon' | 'stick' | 'sphere')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cartoon">Cartoon</option>
              <option value="stick">Stick</option>
              <option value="sphere">Sphere</option>
            </select>
          </div>
          
          {/* Color mode dropdown */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Color</label>
            <select
              value={colorMode}
              onChange={(e) => handleColorModeChange(e.target.value as 'chain' | 'default')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="chain">By Chain</option>
              <option value="default">Default</option>
            </select>
          </div>
          
          {/* Toggle buttons */}
          <div className="flex space-x-2">
            <button
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                showLabels 
                  ? 'bg-black text-white shadow-sm hover:bg-gray-800' 
                  : 'bg-white text-black border border-black hover:bg-gray-100'
              }`}
              onClick={toggleLabels}
              title="Toggle chain and ligand labels"
            >
              Labels
            </button>
            
            <button
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                showLigands 
                  ? 'bg-black text-white shadow-sm hover:bg-gray-800' 
                  : 'bg-white text-black border border-black hover:bg-gray-100'
              }`}
              onClick={toggleLigands}
              title="Show/hide ligands and cofactors"
            >
              Ligands
            </button>
          </div>
          
          {/* Action buttons */}
          <div className="flex space-x-1">
            <button
              className="p-2 text-white bg-black hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={downloadImage}
              disabled={loading || !!error}
              title="Download structure image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Viewer container */}
      <div className="flex-1 relative bg-gray-50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm font-medium text-gray-700">Loading {pdbId.toUpperCase()}...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="text-center p-6 max-w-md">
              <div className="w-12 h-12 mx-auto mb-4 text-red-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-red-900 mb-2">Error loading structure</h3>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <button 
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                onClick={initializeViewer}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        <div 
          ref={viewerRef} 
          className="w-full h-full min-h-[400px]"
          style={{ 
            opacity: loading || error ? 0.1 : 1,
            transition: 'opacity 0.3s ease'
          }}
        />
      </div>
      
      {/* Footer with instructions */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex items-center justify-center space-x-4">
          <span className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
            Left drag: rotate
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            Right drag: zoom
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
            Middle drag: pan
          </span>
        </div>
      </div>
    </div>
  );
};

// Demo component to show the viewer in action
const ProteinViewerDemo = () => {
  const [selectedPdb, setSelectedPdb] = useState('1crn');
  const [showViewer, setShowViewer] = useState(true);
  
  const sampleProteins = [
    { id: '1crn', name: 'Crambin' },
    { id: '1hho', name: 'Hemoglobin' },
    { id: '1bna', name: 'DNA Double Helix' },
    { id: '2hhb', name: 'Hemoglobin Beta' }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Protein Structure Viewer</h1>
          <p className="text-gray-600 mb-6">Interactive 3D visualization of protein structures from the Protein Data Bank</p>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Sample Proteins:</label>
              <div className="flex space-x-2">
                {sampleProteins.map((protein) => (
                  <button
                    key={protein.id}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      selectedPdb === protein.id 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedPdb(protein.id)}
                  >
                    {protein.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Custom PDB ID:</label>
              <input
                type="text"
                value={selectedPdb}
                onChange={(e) => setSelectedPdb(e.target.value.toLowerCase())}
                placeholder="e.g., 1crn"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => setShowViewer(true)}
              >
                Load
              </button>
            </div>
          </div>
        </div>

        {showViewer && (
          <div className="h-[800px]">
            <Viewer 
              pdbId={selectedPdb} 
              onClose={() => setShowViewer(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProteinViewerDemo;