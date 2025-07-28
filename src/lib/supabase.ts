import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface PDBEntry {
  id?: number;
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
  created_at?: string;
  updated_at?: string;
}

export interface UserBookmark {
  id?: number;
  user_id: string;
  pdb_id: string;
  created_at?: string;
}

// PDB Database functions with inverted index support
export const pdbService = {
  // Get all PDB entries with optional basic search
  async getPDBEntries(searchQuery?: string, limit = 50, offset = 0) {
    if (!searchQuery) {
      // No search query - return recent entries
      const { data, error } = await supabase
        .from('pdb_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Error fetching PDB entries:', error);
        return [];
      }
      
      return data || [];
    }

    // Use advanced search function with inverted indices
    return this.advancedSearch(searchQuery, limit, offset);
  },

  // Advanced full-text search using inverted indices
  async advancedSearch(searchQuery: string, limit = 50, offset = 0) {
    const { data, error } = await supabase
      .rpc('search_pdb_entries', {
        search_query: searchQuery,
        limit_count: limit,
        offset_count: offset
      });

    if (error) {
      console.error('Error in advanced search:', error);
      return [];
    }

    return data || [];
  },

  // Fuzzy search using trigram indices
  async fuzzySearch(searchQuery: string, similarityThreshold = 0.3, limit = 50) {
    const { data, error } = await supabase
      .rpc('fuzzy_search_pdb_entries', {
        search_query: searchQuery,
        similarity_threshold: similarityThreshold,
        limit_count: limit
      });

    if (error) {
      console.error('Error in fuzzy search:', error);
      return [];
    }

    return data || [];
  },

  // Hybrid search combining full-text and fuzzy search
  async hybridSearch(searchQuery: string, limit = 50) {
    const [fullTextResults, fuzzyResults] = await Promise.all([
      this.advancedSearch(searchQuery, Math.ceil(limit * 0.7)),
      this.fuzzySearch(searchQuery, 0.3, Math.ceil(limit * 0.3))
    ]);

    // Combine and deduplicate results
    const combinedResults = [...fullTextResults];
    const existingIds = new Set(fullTextResults.map((r: any) => r.pdb_id));
    
    for (const fuzzyResult of fuzzyResults) {
      if (!existingIds.has(fuzzyResult.pdb_id)) {
        combinedResults.push(fuzzyResult);
      }
    }

    return combinedResults.slice(0, limit);
  },

  // Search by specific fields using inverted indices
  async searchByField(field: keyof PDBEntry, value: string, limit = 50) {
    let query = supabase.from('pdb_entries').select('*');

    switch (field) {
      case 'keywords':
      case 'authors':
        // Use GIN index for array fields
        query = query.contains(field, [value]);
        break;
      case 'protein_name':
      case 'organism':
      case 'classification':
        // Use trigram index for fuzzy matching
        query = query.ilike(field, `%${value}%`);
        break;
      default:
        // Use B-tree index for exact matching
        query = query.eq(field, value);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error searching by ${field}:`, error);
      return [];
    }

    return data || [];
  },

  // Get single PDB entry
  async getPDBEntry(pdbId: string) {
    const { data, error } = await supabase
      .from('pdb_entries')
      .select('*')
      .eq('pdb_id', pdbId)
      .single();

    if (error) {
      console.error('Error fetching PDB entry:', error);
      return null;
    }

    return data;
  },

  // Insert PDB entries (for data migration)
  async insertPDBEntries(entries: Omit<PDBEntry, 'id' | 'created_at' | 'updated_at'>[]) {
    const { data, error } = await supabase
      .from('pdb_entries')
      .insert(entries)
      .select();

    if (error) {
      console.error('Error inserting PDB entries:', error);
      return null;
    }

    return data;
  },

  // Get search suggestions using inverted indices
  async getSearchSuggestions(partialQuery: string, limit = 10) {
    const { data, error } = await supabase
      .from('pdb_entries')
      .select('protein_name, organism, classification')
      .or(`
        protein_name.ilike.%${partialQuery}%,
        organism.ilike.%${partialQuery}%,
        classification.ilike.%${partialQuery}%
      `)
      .limit(limit);

    if (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }

    // Extract unique suggestions
    const suggestions = new Set<string>();
    data?.forEach(entry => {
      if (entry.protein_name?.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(entry.protein_name);
      }
      if (entry.organism?.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(entry.organism);
      }
      if (entry.classification?.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(entry.classification);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }
};

// Bookmark functions (requires authentication)
export const bookmarkService = {
  // Get user bookmarks
  async getUserBookmarks(userId: string) {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select(`
        *,
        pdb_entries (*)
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching bookmarks:', error);
      return [];
    }

    return data || [];
  },

  // Add bookmark
  async addBookmark(userId: string, pdbId: string) {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .insert({ user_id: userId, pdb_id: pdbId })
      .select();

    if (error) {
      console.error('Error adding bookmark:', error);
      return null;
    }

    return data;
  },

  // Remove bookmark
  async removeBookmark(userId: string, pdbId: string) {
    const { error } = await supabase
      .from('user_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('pdb_id', pdbId);

    if (error) {
      console.error('Error removing bookmark:', error);
      return false;
    }

    return true;
  }
};
