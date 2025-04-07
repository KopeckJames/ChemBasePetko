import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { type SearchQuery, type SearchResponse } from '@shared/schema';

export function useSearch() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  // Parse search parameters from URL
  const initialQuery: SearchQuery = {
    query: params.get('query') || '',
    searchType: (params.get('searchType') as 'semantic' | 'keyword') || 'semantic',
    molecularWeight: params.get('molecularWeight') as any || '',
    chemicalClass: params.get('chemicalClass') as any || '',
    sort: (params.get('sort') as 'relevance' | 'molecular_weight' | 'name') || 'relevance',
    page: parseInt(params.get('page') || '1'),
    limit: parseInt(params.get('limit') || '10')
  };

  // Local state for form inputs
  const [searchState, setSearchState] = useState<SearchQuery>(initialQuery);
  
  // Effect to update search state when URL params change
  useEffect(() => {
    setSearchState(initialQuery);
  }, [search]);

  // Query for search results
  const searchResults = useQuery<SearchResponse>({
    queryKey: [
      `/api/search?query=${encodeURIComponent(searchState.query)}` +
      `&searchType=${searchState.searchType}` +
      `&molecularWeight=${searchState.molecularWeight}` +
      `&chemicalClass=${searchState.chemicalClass}` +
      `&sort=${searchState.sort}` +
      `&page=${searchState.page}` +
      `&limit=${searchState.limit}`
    ],
    // Only run the query if we have a query string
    enabled: !!searchState.query,
    // Don't refetch on window focus - the data won't change
    refetchOnWindowFocus: false,
  });

  // Function to update URL and trigger search
  const updateSearch = (newSearch: Partial<SearchQuery>) => {
    const updatedSearch = { ...searchState, ...newSearch };
    
    // Don't trigger a search if the query is empty
    if (!updatedSearch.query) return;
    
    // Reset to page 1 when changing filters
    if (newSearch.searchType || newSearch.molecularWeight || 
        newSearch.chemicalClass || newSearch.sort) {
      updatedSearch.page = 1;
    }
    
    // Update URL parameters
    const queryParams = new URLSearchParams();
    queryParams.set('query', updatedSearch.query);
    queryParams.set('searchType', updatedSearch.searchType);
    if (updatedSearch.molecularWeight) queryParams.set('molecularWeight', updatedSearch.molecularWeight);
    if (updatedSearch.chemicalClass) queryParams.set('chemicalClass', updatedSearch.chemicalClass);
    queryParams.set('sort', updatedSearch.sort);
    queryParams.set('page', updatedSearch.page.toString());
    queryParams.set('limit', updatedSearch.limit.toString());
    
    // Navigate to search page with updated parameters
    setLocation(`/search?${queryParams.toString()}`);
  };

  // Function to handle page changes
  const handlePageChange = (newPage: number) => {
    updateSearch({ page: newPage });
  };

  return {
    searchState,
    setSearchState,
    updateSearch,
    handlePageChange,
    searchResults: searchResults.data,
    isLoading: searchResults.isLoading,
    isError: searchResults.isError,
    error: searchResults.error,
  };
}
