import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SAMPLE_QUERIES } from '@/lib/constants';
import { Biohazard } from 'lucide-react';

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    if (query.trim()) {
      const params = new URLSearchParams();
      params.set('query', query);
      params.set('searchType', 'semantic');
      setLocation(`/search?${params.toString()}`);
    }
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-3xl mx-auto shadow-lg">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="flex items-center justify-center mb-6">
            <Biohazard className="w-12 h-12 text-primary mr-4" />
            <h1 className="text-4xl font-bold text-gray-900">ChemSearch</h1>
          </div>
          
          <p className="text-center text-gray-600 mb-8 max-w-md">
            Explore a vector database of 1,000 chemical compounds from PubChem using natural language queries.
          </p>
          
          <div className="w-full space-y-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter a natural language query about chemical compounds..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-4 pr-12 py-3 text-lg"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
                onClick={handleSearch}
              >
                <Biohazard className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
            </div>
            
            <Button
              onClick={handleSearch}
              className="w-full py-6 text-lg"
              disabled={!query.trim()}
            >
              Search Chemical Compounds
            </Button>
          </div>
          
          <div className="mt-8 w-full">
            <p className="text-sm text-gray-500 mb-2">Try these example queries:</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((sampleQuery, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-sm"
                  onClick={() => handleSampleQuery(sampleQuery)}
                >
                  {sampleQuery}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="mt-8 text-xs text-gray-500 border-t border-gray-200 pt-6 w-full">
            <p className="text-center">
              Database contains 1,000 compounds from PubChem with vector embeddings via Weaviate
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
