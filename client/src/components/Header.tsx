import { Biohazard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { Link } from 'wouter';

export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center space-x-2 text-gray-900 hover:text-primary transition-colors">
            <Biohazard className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          </a>
        </Link>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600 hidden sm:inline">Vector Database: 1000 PubChem Compounds</span>
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <span className="hidden sm:inline">Settings</span>
            <Biohazard className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
