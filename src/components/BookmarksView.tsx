import { Bookmark as BookmarkIcon, Bus, MapPin, Trash2 } from 'lucide-react';
import { useBookmarkStore, Bookmark } from '../lib/store';
import { Route, Stop } from '../lib/api';

interface BookmarksViewProps {
  onSelectRoute: (route: Route, initialDir?: 'inbound' | 'outbound') => void;
  onSelectStop: (route: Route, stop: Stop, dir: 'inbound' | 'outbound') => void;
  onSelectStopOnly: (stop: Stop) => void;
}

export function BookmarksView({ onSelectRoute, onSelectStop, onSelectStopOnly }: BookmarksViewProps) {
  const { bookmarks, removeBookmark } = useBookmarkStore();

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <BookmarkIcon className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">暫無收藏</p>
        <p className="text-sm mt-2">將常用的路線及車站加入收藏夾，方便隨時查看。</p>
      </div>
    );
  }

  const handleSelect = (b: Bookmark) => {
    if (b.type === 'stop-only' && b.stopId) {
      const stop: Stop = {
        company: b.company,
        stopId: b.stopId,
        name: b.name,
        seq: 0,
      };
      onSelectStopOnly(stop);
      return;
    }

    const route: Route = {
      company: b.company,
      route: b.route,
      routeId: b.routeId,
      bound: b.bound,
      serviceType: b.serviceType,
      orig: b.orig || '',
      dest: b.dest || '',
    };

    if (b.type === 'route') {
      onSelectRoute(route, b.dir);
    } else if (b.type === 'stop' && b.stopId && b.dir) {
      const stop: Stop = {
        company: b.company,
        stopId: b.stopId,
        name: b.name,
        seq: 0,
      };
      onSelectStop(route, stop, b.dir);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4 px-2">已收藏項目</h2>
      <ul className="grid gap-3">
        {bookmarks.map((b) => (
          <li key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group">
            <div className="flex items-center">
              <button
                onClick={() => handleSelect(b)}
                className="flex-1 text-left px-4 py-4 hover:bg-gray-50 flex items-center gap-4 transition-colors"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-100 text-red-600">
                  {b.type === 'route' ? <Bus className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    {b.name}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      b.company === 'KMB' ? 'bg-red-100 text-red-700' :
                      b.company === 'CTB' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {b.company === 'KMB' ? '九巴' : b.company === 'CTB' ? '城巴' : '大嶼山巴士'}
                    </span>
                  </div>
                  {b.subtitle && <div className="text-sm text-gray-500 mt-0.5">{b.subtitle}</div>}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBookmark(b.id);
                }}
                className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="移除收藏"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
