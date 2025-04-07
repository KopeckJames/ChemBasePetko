import { useState, useEffect } from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem,
  PaginationLink,
  PaginationNext, 
  PaginationPrevious
} from '@/components/ui/pagination';
import CompoundCard from './CompoundCard';
import { SORT_OPTIONS } from '@/lib/constants';
import { type SearchResponse, type SearchQuery, type CompoundSearchResult } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface ResultsPanelProps {
  searchResults: SearchResponse | undefined;
  searchState: SearchQuery;
  updateSearch: (newSearch: Partial<SearchQuery>) => void;
  handlePageChange: (newPage: number) => void;
  isLoading: boolean;
  isError: boolean;
  onViewDetails: (compound: CompoundSearchResult) => void;
}

export default function ResultsPanel({
  searchResults,
  searchState,
  updateSearch,
  handlePageChange,
  isLoading,
  isError,
  onViewDetails
}: ResultsPanelProps) {
  const [resultsCount, setResultsCount] = useState<string>("");

  useEffect(() => {
    if (searchResults) {
      const { page, totalResults, results, query } = searchResults;
      const start = ((page - 1) * searchState.limit) + 1;
      const end = start + results.length - 1;
      
      setResultsCount(`Showing ${start}-${end} of ${totalResults} results for ${query}`);
    }
  }, [searchResults, searchState.limit]);

  const handleSortChange = (value: string) => {
    updateSearch({ sort: value as 'relevance' | 'molecular_weight' | 'name' });
  };

  // Generate pagination items
  const renderPaginationItems = () => {
    if (!searchResults) return null;
    
    const { page, totalPages } = searchResults;
    const items = [];
    
    // Always show first page
    items.push(
      <PaginationItem key="page-1">
        <PaginationLink
          isActive={page === 1}
          onClick={() => handlePageChange(1)}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );
    
    // Show ellipsis if needed
    if (page > 3) {
      items.push(
        <PaginationItem key="ellipsis-1">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Show pages around current page
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      items.push(
        <PaginationItem key={`page-${i}`}>
          <PaginationLink
            isActive={page === i}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    // Show ellipsis if needed
    if (page < totalPages - 2) {
      items.push(
        <PaginationItem key="ellipsis-2">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Always show last page if there is more than one page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={`page-${totalPages}`}>
          <PaginationLink
            isActive={page === totalPages}
            onClick={() => handlePageChange(totalPages)}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  return (
    <section className="w-full lg:w-2/3 flex flex-col">
      <Card className="bg-white rounded-lg shadow divide-y divide-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Search Results</h2>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">Sort by:</span>
              <Select value={searchState.sort} onValueChange={handleSortChange}>
                <SelectTrigger className="h-8 text-sm min-w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Loading results...' : resultsCount}
          </p>
        </div>

        {isLoading && (
          <div className="divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 flex flex-col md:flex-row gap-4">
                <div className="md:w-1/3 flex-shrink-0 flex flex-col items-center">
                  <Skeleton className="w-40 h-40 rounded-lg" />
                  <Skeleton className="w-20 h-4 mt-2" />
                </div>
                <div className="md:w-2/3 space-y-4">
                  <div className="flex justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-60" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="flex space-x-3">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="p-10 flex flex-col items-center justify-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Results</h3>
            <p className="text-gray-500 text-center max-w-md">
              There was an error retrieving search results. Please try again or check your search parameters.
            </p>
          </div>
        )}

        {!isLoading && !isError && searchResults?.results.length === 0 && (
          <div className="p-10 flex flex-col items-center justify-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-500 text-center max-w-md">
              No compounds matched your search criteria. Try different keywords or filters.
            </p>
          </div>
        )}

        {!isLoading && !isError && searchResults?.results && (
          <div className="divide-y divide-gray-200">
            {searchResults.results.map((compound) => (
              <CompoundCard 
                key={compound.cid} 
                compound={compound} 
                onViewDetails={() => onViewDetails(compound)} 
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && searchResults?.totalPages > 1 && (
          <div className="p-6 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => {
                      if (searchResults.page > 1) {
                        handlePageChange(searchResults.page - 1);
                      }
                    }}
                    isDisabled={searchResults.page === 1}
                  />
                </PaginationItem>
                
                {renderPaginationItems()}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => {
                      if (searchResults.page < searchResults.totalPages) {
                        handlePageChange(searchResults.page + 1);
                      }
                    }}
                    isDisabled={searchResults.page === searchResults.totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
    </section>
  );
}
