import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, X } from 'lucide-react';
import { type CompoundSearchResult } from '@shared/schema';
import { DEFAULT_IMAGE_URL } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';

interface CompoundModalProps {
  compound: CompoundSearchResult;
  isOpen: boolean;
  onClose: () => void;
}

export default function CompoundModal({ compound, isOpen, onClose }: CompoundModalProps) {
  // Get more details about the compound if available
  const { data: detailedCompound, isLoading } = useQuery({
    queryKey: [`/api/compounds/${compound.cid}`],
    enabled: isOpen, // Only fetch when modal is open
  });

  // Use either detailed data or the passed compound data
  const displayCompound = detailedCompound || compound;
  
  // Format chemical formula with subscripts
  const formatFormula = (formula: string) => {
    if (!formula) return '';
    return formula.replace(/(\d+)/g, '₍$1₎').replace(/₍/g, '').replace(/₎/g, '');
  };

  // Open PubChem page for the compound
  const handlePubchemClick = () => {
    window.open(`https://pubchem.ncbi.nlm.nih.gov/compound/${compound.cid}`, '_blank');
  };

  // Download JSON data for the compound
  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(displayCompound, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `compound_${compound.cid}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-200 pb-4">
          <DialogTitle className="text-xl">
            {compound.name} {compound.iupacName && `(${compound.iupacName})`}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 flex flex-col items-center">
              <div className="w-full h-52 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <img 
                  src={compound.imageUrl || DEFAULT_IMAGE_URL} 
                  alt={`${compound.name} chemical structure`} 
                  className="max-w-full max-h-full p-2"
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.src = DEFAULT_IMAGE_URL;
                  }}
                />
              </div>
              
              <div className="w-full bg-gray-100 rounded-lg p-4 space-y-3">
                <div className="text-center">
                  <span className="text-xs font-medium text-gray-500">PubChem CID</span>
                  <p className="font-mono">{compound.cid}</p>
                </div>
                
                <div className="text-center">
                  <span className="text-xs font-medium text-gray-500">Chemical Formula</span>
                  <p className="font-mono">{formatFormula(compound.formula || 'N/A')}</p>
                </div>
                
                <div className="text-center">
                  <span className="text-xs font-medium text-gray-500">Molecular Weight</span>
                  <p>{compound.molecularWeight ? `${compound.molecularWeight.toFixed(2)} g/mol` : 'N/A'}</p>
                </div>
                
                <Button 
                  variant="link" 
                  className="w-full text-sm flex items-center justify-center"
                  onClick={handlePubchemClick}
                >
                  View on PubChem
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Basic Information</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">IUPAC Name:</span>
                    <p className="text-sm text-gray-600">{compound.iupacName || 'Not available'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Synonyms:</span>
                    <p className="text-sm text-gray-600">
                      {detailedCompound?.synonyms?.join(', ') || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Classification:</span>
                    <p className="text-sm text-gray-600">
                      {compound.chemicalClass?.join(', ') || 'Not available'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Chemical Properties</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">InChI:</span>
                    <p className="text-sm text-gray-600 truncate">
                      {detailedCompound?.inchi || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">InChI Key:</span>
                    <p className="text-sm text-gray-600">
                      {detailedCompound?.inchiKey || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">SMILES:</span>
                    <p className="text-sm text-gray-600 truncate">
                      {detailedCompound?.smiles || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Similarity Score:</span>
                    <p className="text-sm text-gray-600">
                      {compound.similarity !== undefined ? `${compound.similarity}%` : 'Not applicable'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600">
                  {compound.description || 'No description available.'}
                </p>
              </div>
            </div>
          </div>
          
          {isLoading && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-center">
                <p className="text-sm text-gray-500">Loading additional compound details...</p>
              </div>
            </div>
          )}
          
          {detailedCompound && detailedCompound?.properties && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Additional Properties</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(detailedCompound.properties).map(([key, value]) => (
                  <div key={key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <span className="text-xs font-medium text-gray-700 block mb-1">{key}</span>
                    <span className="text-sm">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="border-t border-gray-200 pt-4">
          <Button variant="outline" onClick={onClose} className="mr-2">
            Close
          </Button>
          <Button onClick={handleDownload}>
            Download Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
