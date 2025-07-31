'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Viewer } from './Viewer';
import { Search, Eye, Bookmark, BookmarkCheck, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface PDBEntry {
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

interface SearchInterfaceProps {
  pdbData: PDBEntry[];
}

// PDB Thumbnail Component
const PDBThumbnail: React.FC<{ pdbId: string; proteinName: string }> = ({ pdbId, proteinName }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  // RCSB PDB provides thumbnail images at this URL pattern
  const thumbnailUrl = `https://cdn.rcsb.org/images/structures/${pdbId.toLowerCase()}_assembly-1.jpeg`;
  
  return (
    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden mb-3">
      {!imageError ? (
        <img
          src={thumbnailUrl}
          alt={`${pdbId} - ${proteinName}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {/* PDB ID overlay */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
        {pdbId.toUpperCase()}
      </div>
    </div>
  );
};

export const SearchInterface: React.FC<SearchInterfaceProps> = ({ pdbData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PDBEntry[]>([]);
  const [selectedPDB, setSelectedPDB] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  // Initialize Fuse.js for fuzzy searching
  const fuse = useMemo(() => {
    const options = {
      keys: [
        { name: 'pdb_id', weight: 0.3 },
        { name: 'protein_name', weight: 0.4 },
        { name: 'organism', weight: 0.2 },
        { name: 'structure_title', weight: 0.3 },
        { name: 'classification', weight: 0.2 },
        { name: 'keywords', weight: 0.1 }
      ],
      threshold: 0.4, // Lower = more strict matching
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    };

    return new Fuse(pdbData, options);
  }, [pdbData]);

  // Load bookmarks from localStorage
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('pdb-bookmarks');
    if (savedBookmarks) {
      setBookmarks(new Set(JSON.parse(savedBookmarks)));
    }
  }, []);

  // Save bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem('pdb-bookmarks', JSON.stringify(Array.from(bookmarks)));
  }, [bookmarks]);

  // Perform search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(showBookmarksOnly ? 
        pdbData.filter(entry => bookmarks.has(entry.pdb_id)).slice(0, 20) :
        pdbData.slice(0, 20)
      );
      return;
    }

    const results = fuse.search(searchQuery);
    const filteredResults = showBookmarksOnly ? 
      results.filter(result => bookmarks.has(result.item.pdb_id)) :
      results;
    
    setSearchResults(filteredResults.map(result => result.item).slice(0, 50));
  }, [searchQuery, fuse, pdbData, showBookmarksOnly, bookmarks]);

  const toggleBookmark = (pdbId: string) => {
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(pdbId)) {
      newBookmarks.delete(pdbId);
    } else {
      newBookmarks.add(pdbId);
    }
    setBookmarks(newBookmarks);
  };

  const openViewer = (pdbId: string) => {
    setSelectedPDB(pdbId);
    setIsViewerOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const formatResolution = (resolution?: number) => {
    if (!resolution) return 'N/A';
    return `${resolution.toFixed(2)} Å`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* Header Buttons */}
      <div className="flex justify-between mb-4">
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => window.location.href = '/'}
          className="text-sm bg-black hover:bg-gray-800 text-white"
        >
          Back
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.open('https://github.com/yuen-liu/pbd-viewer', '_blank')}
          className="text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          GitHub
        </Button>
      </div>
      
      {/* Search Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">PDB Explorer</h1>
        <p className="text-lg text-gray-600">
          Search and visualize protein structures from the Protein Data Bank
        </p>
      </div>

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by PDB ID, protein name, or organism..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 text-lg"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={showBookmarksOnly ? 'default' : 'outline'}
            onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
            className="flex items-center gap-2"
          >
            <Bookmark className="h-4 w-4" />
            Bookmarks ({bookmarks.size})
          </Button>
        </div>
      </div>

      {/* Search Stats */}
      <div className="text-sm text-gray-600 text-center">
        {searchQuery ? (
          <p>Found {searchResults.length} results for &quot;{searchQuery}&quot;</p>
        ) : (
          <p>
            {showBookmarksOnly ? 
              `Showing ${searchResults.length} bookmarked entries` :
              `Showing ${searchResults.length} recent entries from ${pdbData.length} total`
            }
          </p>
        )}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {searchResults.map((entry) => (
          <Card key={entry.pdb_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              {/* Thumbnail */}
              <PDBThumbnail pdbId={entry.pdb_id} proteinName={entry.protein_name} />
              
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-bold text-blue-600">
                    {entry.pdb_id.toUpperCase()}
                  </CardTitle>
                  <CardDescription className="text-sm mt-1 line-clamp-2">
                    {entry.protein_name}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleBookmark(entry.pdb_id)}
                  className="ml-2 p-1"
                >
                  {bookmarks.has(entry.pdb_id) ? (
                    <BookmarkCheck className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 space-y-3">
              {/* Organism */}
              <div>
                <p className="text-sm font-medium text-gray-700">Organism:</p>
                <p className="text-sm text-gray-600 line-clamp-1">{entry.organism}</p>
              </div>

              {/* Method and Resolution */}
              <div className="flex flex-wrap gap-2">
                {entry.method && (
                  <Badge variant="secondary" className="text-xs">
                    {entry.method}
                  </Badge>
                )}
                {entry.resolution && (
                  <Badge variant="outline" className="text-xs">
                    {formatResolution(entry.resolution)}
                  </Badge>
                )}
              </div>

              {/* Keywords */}
              {entry.keywords && entry.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.keywords.slice(0, 3).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {entry.keywords.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{entry.keywords.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Release Date */}
              <p className="text-xs text-gray-500">
                Released: {formatDate(entry.release_date)}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => openViewer(entry.pdb_id)}
                  className="flex-1 flex items-center gap-2"
                  size="sm"
                >
                  <Eye className="h-4 w-4" />
                  View 3D
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://www.rcsb.org/structure/${entry.pdb_id}`, '_blank')}
                  className="flex-1 flex items-center gap-2"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  PDB Site
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No results found for &quot;{searchQuery}&quot;</p>
          <p className="text-gray-400 text-sm mt-2">
            Try searching with different keywords or check your spelling
          </p>
        </div>
      )}

      {/* 3D Viewer Modal */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-5xl w-full h-[80vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>3D Protein Structure Viewer</DialogTitle>
          </DialogHeader>
          {selectedPDB && (
            <Viewer 
              pdbId={selectedPDB} 
              onClose={() => setIsViewerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchInterface;
