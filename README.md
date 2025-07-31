# PDB Explorer

A modern, user-friendly interface for exploring protein structures from the Protein Data Bank (PDB).

![PDB Explorer Screenshot](https://via.placeholder.com/1200x600.png?text=PDB+Explorer+Screenshot)

## ✨ Features

- **Clean Interface**: Minimalist design focused on usability
- **Fast Search**: Instantly find protein structures by ID, name, or organism
- **3D Visualization**: Interactive viewer with multiple rendering styles
- **Bookmarking**: Save and manage your favorite structures
- **Responsive**: Works seamlessly on all devices

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yuen-liu/pbd-viewer.git
   cd pbd-viewer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS + ShadCN UI
- **3D Visualization**: 3Dmol.js
- **Search**: Fuse.js for client-side fuzzy search
- **State Management**: React Hooks
- **Database**: Supabase
- **Deployment**: Vercel

## 📂 Project Structure

```
src/
├── app/                  # App router pages
│   ├── page.tsx         # Landing page
│   └── search/          # Search interface
│       └── page.tsx     # Search results and viewer
├── components/          # Reusable components
│   ├── Viewer.tsx       # 3D structure viewer
│   └── SearchInterface.tsx # Search functionality
└── lib/                 # Utility functions
```

## 🔍 Usage

1. **Search**
   - Enter keywords to search through the PDB database
   - Results update in real-time as you type

2. **View Structures**
   - Click "View 3D" to open the interactive viewer
   - Rotate, zoom, and pan the 3D structure
   - Toggle between different visualization styles

3. **Save Favorites**
   - Bookmark structures for quick access later
   - View all bookmarked structures in one place

## 🌐 Live Demo

Check out the live demo: [https://pdb-explorer.vercel.app](https://pdb-explorer.vercel.app)

## 🔌 APIs & Libraries Used

### External Services
This project integrates with the following RCSB PDB APIs:

- **PDB Search API**: For querying protein structures with advanced search capabilities
  - Endpoint: `https://search.rcsb.org/rcsbsearch/v2/query`
  - Used for: Searching structures by various criteria including molecule name, organism, and experiment type

- **PDB Data API**: For fetching detailed metadata about protein structures
  - Endpoint: `https://data.rcsb.org/rest/v1/core/entry/{entry_id}`
  - Used for: Retrieving comprehensive information about specific PDB entries

- **PDB File Download**: For fetching PDB structure files
  - Endpoint: `https://files.rcsb.org/download/{pdb_id}.pdb`
  - Used for: Downloading PDB structure files for 3D visualization

- **PDB 1D Coordinate Service**: For getting sequence and structure annotations
  - Endpoint: `https://www.ebi.ac.uk/pdbe/api/pdb/entry/summary/{pdb_id}`
  - Used for: Additional structural and experimental metadata

### Core Libraries

#### UI Components
- **Radix UI**: Unstyled, accessible UI primitives
  - Used for: Building accessible dialog and interaction components
  - [Website](https://www.radix-ui.com/)

- **Lucide React**: Beautiful & consistent icons
  - Used for: UI icons throughout the application
  - [GitHub](https://github.com/lucide-icons/lucide)

#### Data & State
- **Fuse.js**: Lightweight fuzzy-search library
  - Used for: Client-side fuzzy search across PDB entries
  - [GitHub](https://github.com/krisk/Fuse)

- **3DMol.js**: WebGL based molecular visualization
  - Used for: 3D rendering of protein structures
  - [Website](https://3dmol.org/)

- **Supabase**: Open source Firebase alternative
  - Used for: Database and backend services
  - [Website](https://supabase.com/)

#### Utilities
- **clsx & tailwind-merge**: For dynamic class name composition
- **class-variance-authority**: For type-safe component variants

✅ **Performance Optimized**: Fast search and rendering

## Future Directions I'm thinking about

- Semantic search: I'm thinking of using the sequence-transformers API to enable this --> would mean users could input functional queries: ex. something like "proteins that phosphorylate tyrosines"
- Structural search: I'm thinking of using APIs like Foldseek and RCSB’s structural similarity endpoint or embedding AlphaFold2 structures via GVPs or pretrained graph models --> definitely very useful, but this would take more time.
- Fetch more PDB data (currently only 1000 PDB entries are in the database) and scale up
- Implement deep links for better SEO & user experience
- Add an MCP server so the app can be deployed by agents
- Export to various formats
- User accounts and cloud bookmarks: definitely doable using Supabase