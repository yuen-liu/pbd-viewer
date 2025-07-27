'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      
      // Set initial style
      applyStyle(newViewer, currentStyle);
      
      // Highlight ligands if enabled
      if (showLigands) {
        highlightLigands(newViewer);
      }
      
      // Set view and render
      newViewer.zoomTo();
      newViewer.render();
      
      setViewer(newViewer);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDB structure:', err);
      setError(err instanceof Error ? err.message : 'Failed to load protein structure');
      setLoading(false);
    }
  };

  const applyStyle = (viewerInstance: any, style: string) => {
    viewerInstance.setStyle({}, {}); // Clear existing styles
    
    switch (style) {
      case 'cartoon':
        viewerInstance.setStyle({}, { cartoon: { color: 'spectrum' } });
        break;
      case 'stick':
        viewerInstance.setStyle({}, { stick: { colorscheme: 'Jmol' } });
        break;
      case 'sphere':
        viewerInstance.setStyle({}, { sphere: { colorscheme: 'Jmol' } });
        break;
    }
    
    viewerInstance.render();
  };

  const highlightLigands = (viewerInstance: any) => {
    // Highlight heteroatoms (ligands) in a different style
    viewerInstance.setStyle({ hetflag: true }, { 
      stick: { 
        colorscheme: 'greenCarbon',
        radius: 0.3
      }
    });
  };

  const handleStyleChange = (newStyle: 'cartoon' | 'stick' | 'sphere') => {
    if (viewer) {
      setCurrentStyle(newStyle);
      applyStyle(viewer, newStyle);
      if (showLigands) {
        highlightLigands(viewer);
      }
    }
  };

  const toggleLigands = () => {
    if (viewer) {
      setShowLigands(!showLigands);
      applyStyle(viewer, currentStyle);
      if (!showLigands) {
        highlightLigands(viewer);
      }
    }
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
    <div className="w-full h-full flex flex-col">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">PDB: {pdbId.toUpperCase()}</h3>
          <Badge variant="outline">3D Structure</Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Style controls */}
          <div className="flex gap-1">
            {(['cartoon', 'stick', 'sphere'] as const).map((style) => (
              <Button
                key={style}
                variant={currentStyle === style ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleChange(style)}
                className="capitalize"
              >
                {style}
              </Button>
            ))}
          </div>
          
          {/* Ligand toggle */}
          <Button
            variant={showLigands ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLigands}
          >
            Ligands
          </Button>
          
          {/* Download button */}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImage}
            disabled={loading || !!error}
          >
            📷 Save
          </Button>
          
          {/* Close button */}
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Viewer container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading {pdbId.toUpperCase()}...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
            <div className="text-center p-4">
              <p className="text-red-600 font-medium mb-2">Error loading structure</p>
              <p className="text-sm text-red-500">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={initializeViewer}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        
        <div 
          ref={viewerRef} 
          className="w-full h-full min-h-[400px]"
          style={{ 
            opacity: loading || error ? 0.3 : 1,
            transition: 'opacity 0.3s ease'
          }}
        />
      </div>
      
      {/* Footer with instructions */}
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-600">
        <p>🖱️ Left click + drag: rotate | 🖱️ Right click + drag: zoom | 🖱️ Middle click + drag: pan</p>
      </div>
    </div>
  );
};

export default Viewer;
