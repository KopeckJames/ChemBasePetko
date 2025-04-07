import { useState } from 'react';
import SearchPanel from '@/components/SearchPanel';
import ResultsPanel from '@/components/ResultsPanel';
import CompoundModal from '@/components/CompoundModal';
import { useSearch } from '@/hooks/use-search';
import { type CompoundSearchResult } from '@shared/schema';

export default function SearchPage() {
  const {
    searchState,
    setSearchState,
    updateSearch,
    handlePageChange,
    searchResults,
    isLoading,
    isError,
  } = useSearch();

  const [selectedCompound, setSelectedCompound] = useState<CompoundSearchResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewDetails = (compound: CompoundSearchResult) => {
    setSelectedCompound(compound);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <main className="flex-grow flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
      <SearchPanel 
        searchState={searchState}
        setSearchState={setSearchState}
        updateSearch={updateSearch}
      />
      
      <ResultsPanel 
        searchResults={searchResults}
        searchState={searchState}
        updateSearch={updateSearch}
        handlePageChange={handlePageChange}
        isLoading={isLoading}
        isError={isError}
        onViewDetails={handleViewDetails}
      />
      
      {selectedCompound && (
        <CompoundModal
          compound={selectedCompound}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </main>
  );
}
