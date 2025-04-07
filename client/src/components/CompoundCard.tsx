import { Button } from '@/components/ui/button';
import { Info, ExternalLink, Bookmark } from 'lucide-react';
import { type CompoundSearchResult } from '@shared/schema';
import { DEFAULT_IMAGE_URL } from '@/lib/constants';

interface CompoundCardProps {
  compound: CompoundSearchResult;
  onViewDetails: () => void;
}

export default function CompoundCard({ compound, onViewDetails }: CompoundCardProps) {
  const {
    cid,
    name,
    iupacName,
    formula,
    molecularWeight,
    chemicalClass,
    description,
    similarity,
    imageUrl
  } = compound;

  // Open PubChem page for the compound
  const handlePubchemClick = () => {
    window.open(`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, '_blank');
  };

  // Format chemical formula with subscripts
  const formatFormula = (formula: string) => {
    if (!formula) return '';
    return formula.replace(/(\d+)/g, '₍$1₎').replace(/₍/g, '').replace(/₎/g, '');
  };

  return (
    <div className="p-6 flex flex-col md:flex-row gap-4 hover:bg-gray-50">
      <div className="md:w-1/3 flex-shrink-0 flex flex-col items-center justify-center">
        <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
          <img 
            src={imageUrl || DEFAULT_IMAGE_URL} 
            alt={`${name} chemical structure`} 
            className="max-w-full max-h-full p-2"
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.src = DEFAULT_IMAGE_URL;
            }}
          />
        </div>
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-500">PubChem CID: {cid}</span>
        </div>
      </div>
      
      <div className="md:w-2/3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{name}</h3>
            <p className="text-sm text-gray-600">{iupacName || 'No IUPAC name available'}</p>
          </div>
          {similarity !== undefined && (
            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              Similarity: {similarity}%
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Formula:</span>
            <span className="ml-1 font-mono">{formatFormula(formula || 'N/A')}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">Mol. Weight:</span>
            <span className="ml-1">
              {molecularWeight ? `${molecularWeight.toFixed(2)} g/mol` : 'N/A'}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">IUPAC:</span>
            <span className="ml-1 truncate">{iupacName || 'N/A'}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">Class:</span>
            <span className="ml-1">
              {chemicalClass && chemicalClass.length > 0 ? chemicalClass[0] : 'N/A'}
            </span>
          </div>
        </div>
        
        <div className="mt-3">
          <p className="text-sm text-gray-600 line-clamp-2">
            {description || 'No description available.'}
          </p>
        </div>
        
        <div className="mt-4 flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-indigo-700 font-medium" 
            onClick={onViewDetails}
          >
            <Info className="h-4 w-4 mr-1" />
            View Details
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-700 hover:text-gray-900 font-medium"
            onClick={handlePubchemClick}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            PubChem
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-700 hover:text-gray-900 font-medium"
          >
            <Bookmark className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
