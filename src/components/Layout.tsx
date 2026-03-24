import { ReactNode } from 'react';
import { Bus, Bookmark, Search, MapPin } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: 'bookmarks' | 'search' | 'stop-search';
  onTabChange: (tab: 'bookmarks' | 'search' | 'stop-search') => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-red-600 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wide">香港巴士到站預報</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto flex">
          <button
            onClick={() => onTabChange('bookmarks')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'bookmarks' ? 'border-white text-white' : 'border-transparent text-red-200 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            收藏夾
          </button>
          <button
            onClick={() => onTabChange('search')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'search' ? 'border-white text-white' : 'border-transparent text-red-200 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            路線搜尋
          </button>
          <button
            onClick={() => onTabChange('stop-search')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'stop-search' ? 'border-white text-white' : 'border-transparent text-red-200 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            車站搜尋
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
