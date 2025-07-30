# PDB Viewer

A full-stack web application for searching and visualizing protein structures from the Protein Data Bank (PDB).

## Features

🔍 **Advanced Search**: Fuzzy search through PDB entries by ID, protein name, or organism using Fuse.js

🧬 **3D Visualization**: Interactive protein structure viewer powered by 3Dmol.js with multiple rendering styles

📱 **Mobile Responsive**: Optimized for all screen sizes with modern UI components

🔖 **Bookmarking**: Save favorite protein structures locally

⚡ **Performance**: Fast search with live results and optimized data loading

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Styling**: Tailwind CSS + ShadCN UI components
- **Search**: Fuse.js for fuzzy searching
- **3D Rendering**: 3Dmol.js for protein visualization
- **Data**: PDB REST API for metadata fetching
- **Deployment**: Vercel-ready

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Fetch PDB Metadata (Optional)

To get a full dataset of ~5000 PDB entries, use the Python script:

```bash
# Fetch full dataset (takes ~10-15 minutes)
npm run fetch-pdb

# Or fetch smaller dataset for testing (100 entries)
npm run fetch-pdb-small
```

**Note**: The app includes sample data and will work without fetching the full dataset.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main application page
│   └── globals.css       # Global styles
├── components/
│   ├── Viewer.tsx        # 3D protein structure viewer
│   ├── SearchInterface.tsx # Search and results interface
│   └── ui/              # ShadCN UI components
scripts/
└── fetch-pdb-metadata.js # PDB data fetching script
public/
└── pdb-summary.json     # Generated metadata file
```

## Key Components

### Viewer Component

- **File**: `src/components/Viewer.tsx`
- **Features**: 
  - 3D protein structure rendering
  - Multiple visualization styles (cartoon, stick, sphere)
  - Ligand highlighting
  - Interactive controls (rotate, zoom, pan)
  - Screenshot download

### Search Interface

- **File**: `src/components/SearchInterface.tsx`
- **Features**:
  - Real-time fuzzy search
  - Bookmarking system
  - Responsive card layout
  - Modal integration with 3D viewer

### Metadata Fetcher

- **File**: `scripts/fetch-pdb-metadata.js`
- **Features**:
  - Fetches high-quality structures (X-ray, EM, NMR)
  - Filters by resolution (0.5-4.0 Å)
  - Extracts comprehensive metadata
  - Rate-limited API calls

## Usage

1. **Search**: Type in the search box to find proteins by PDB ID, name, or organism
2. **View**: Click "View 3D Structure" to open the interactive 3D viewer
3. **Bookmark**: Click the bookmark icon to save favorite structures
4. **Visualize**: Use the style controls in the viewer to change rendering modes
5. **Download**: Save screenshots of protein structures

## API Integration

The app integrates with:

- **PDB Search API**: For querying protein structures
- **PDB Data API**: For fetching detailed metadata
- **RCSB PDB Files**: For downloading structure files

## Performance Optimizations

- **Lazy Loading**: 3Dmol.js loaded on demand
- **Search Debouncing**: Optimized search performance
- **Result Limiting**: Capped at 50 results for fast rendering
- **Local Storage**: Bookmarks persisted locally

## Deployment

### Vercel (Recommended)

1. Push to GitHub repository
2. Connect to Vercel
3. Deploy automatically

### Manual Build

```bash
npm run build
npm start
```

## Bonus Features Implemented

✅ **Ligand Highlighting**: Heteroatoms highlighted in different colors

✅ **Style Toggling**: Multiple visualization modes (cartoon, stick, sphere)

✅ **Bookmarking**: Save and filter favorite structures

✅ **Mobile Responsive**: Works on all devices

✅ **Performance Optimized**: Fast search and rendering

## Future Enhancements

- Dark mode toggle
- Advanced filtering (resolution, method, date)
- Protein comparison view
- Export to various formats
- User accounts and cloud bookmarks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
