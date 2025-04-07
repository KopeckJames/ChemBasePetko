import { Biohazard } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-2">
            <Biohazard className="h-4 w-4 text-primary" />
            <span className="text-sm text-gray-500">{APP_NAME} Vector Database</span>
          </div>
          <div className="mt-2 sm:mt-0">
            <span className="text-xs text-gray-500">Powered by Weaviate & PubChem Data</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
