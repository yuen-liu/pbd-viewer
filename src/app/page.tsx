import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>PDB Explorer</h1>
          <p className="text-xl text-gray-600 mb-8">
            Explore protein structures from the Protein Data Bank
          </p>
          <Link 
            href="/search"
            className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-8 rounded-lg transition-colors duration-300 text-lg"
            style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
          >
            View Database
          </Link>
        </div>
      </main>
    </div>
  );
}
