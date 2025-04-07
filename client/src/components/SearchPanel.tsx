import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { SearchIcon } from 'lucide-react';
import { MOLECULAR_WEIGHT_OPTIONS, CHEMICAL_CLASS_OPTIONS, SEARCH_TYPES } from '@/lib/constants';
import { type SearchQuery } from '@shared/schema';

interface SearchPanelProps {
  searchState: SearchQuery;
  setSearchState: React.Dispatch<React.SetStateAction<SearchQuery>>;
  updateSearch: (newSearch: Partial<SearchQuery>) => void;
}

export default function SearchPanel({ searchState, setSearchState, updateSearch }: SearchPanelProps) {
  const handleQueryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchState({ ...searchState, query: e.target.value });
  };

  const handleSearchTypeChange = (value: 'semantic' | 'keyword') => {
    setSearchState({ ...searchState, searchType: value });
  };

  const handleMolecularWeightChange = (value: string) => {
    setSearchState({ ...searchState, molecularWeight: value as any });
  };

  const handleChemicalClassChange = (value: string) => {
    setSearchState({ ...searchState, chemicalClass: value as any });
  };

  const handleSearch = () => {
    if (searchState.query.trim()) {
      updateSearch(searchState);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="w-full lg:w-1/3 flex flex-col">
      <Card className="bg-white rounded-lg shadow p-6 flex flex-col gap-4 sticky top-6">
        <h2 className="text-lg font-medium text-gray-900">Natural Language Query</h2>
        
        <div className="space-y-1">
          <Label htmlFor="query">Search Chemical Compounds</Label>
          <div className="relative">
            <Input
              id="query"
              value={searchState.query}
              onChange={handleQueryInput}
              onKeyPress={handleKeyPress}
              className="w-full pl-4 pr-10"
              placeholder="E.g., Find compounds similar to aspirin"
            />
            <SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">Use natural language to search for chemical compounds</p>
        </div>

        <div className="space-y-1">
          <Label>Search Type</Label>
          <RadioGroup 
            value={searchState.searchType} 
            onValueChange={handleSearchTypeChange as (value: string) => void}
            className="flex items-center space-x-4 pt-1"
          >
            {SEARCH_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <RadioGroupItem value={type.value} id={`search-type-${type.value}`} />
                <Label htmlFor={`search-type-${type.value}`} className="cursor-pointer">
                  {type.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3 pt-3 border-t border-gray-200 mt-2">
          <div>
            <Label>Filter Results</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <Select 
                value={searchState.molecularWeight} 
                onValueChange={handleMolecularWeightChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Molecular Weight" />
                </SelectTrigger>
                <SelectContent>
                  {MOLECULAR_WEIGHT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={searchState.chemicalClass} 
                onValueChange={handleChemicalClassChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chemical Class" />
                </SelectTrigger>
                <SelectContent>
                  {CHEMICAL_CLASS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSearch}
          className="mt-2 w-full"
          disabled={!searchState.query.trim()}
        >
          Search Database
        </Button>

        <div className="text-xs text-gray-500 pt-3 border-t border-gray-200 mt-1">
          <p>Database Info:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>1,000 compounds from PubChem</li>
            <li>Vector embeddings via Weaviate</li>
            <li>Last updated: May 15, 2023</li>
          </ul>
        </div>
      </Card>
    </section>
  );
}
