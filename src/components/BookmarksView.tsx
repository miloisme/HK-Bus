import { Bookmark as BookmarkIcon, Bus, MapPin, Trash2 } from 'lucide-react';
import { useBookmarkStore, type Bookmark } from '../lib/store';
import { bookmarkToStop, bookmarkToVariant } from '../lib/bookmarks';
import type { RouteVariant, Stop } from '../lib/types';
import { InlineETA } from './InlineETA';
import { OperatorBadge } from './OperatorBadge';

interface BookmarksViewProps {
  onSelectRoute: (variant: RouteVariant) => void;
  onSelectStop: (variant: RouteVariant, stop: Stop) => void;
  onSelectStopOnly: (stop: Stop) => void;
}

export function BookmarksView({
  onSelectRoute,
  onSelectStop,
  onSelectStopOnly,
}: BookmarksViewProps) {
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

  const handleSelect = (bookmark: Bookmark) => {
    const stop = bookmarkToStop(bookmark);
    if (!stop) return;

    if (bookmark.type === 'stop-only') {
      onSelectStopOnly(stop);
      return;
    }

    const variant = bookmarkToVariant(bookmark);
    if (!variant) return;

    if (bookmark.type === 'route') {
      onSelectRoute(variant);
    } else {
      onSelectStop(variant, stop);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4 px-2">已收藏項目</h2>
      <ul className="grid gap-3">
        {bookmarks.map((bookmark) => {
          const variant = bookmarkToVariant(bookmark);
          const stop = bookmarkToStop(bookmark);
          const isRoute = bookmark.type === 'route';

          return (
            <li
              key={bookmark.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group"
            >
              <div className="flex items-center">
                <button
                  onClick={() => handleSelect(bookmark)}
                  className="flex-1 text-left px-4 py-4 hover:bg-gray-50 flex items-center gap-4 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isRoute ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {isRoute ? <Bus className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="truncate">{bookmark.name}</span>
                      <OperatorBadge company={bookmark.company} />
                    </div>
                    {bookmark.subtitle && (
                      <div className="text-sm text-gray-500 mt-0.5 truncate">{bookmark.subtitle}</div>
                    )}
                    {!isRoute && stop && (
                      <div className="mt-1.5">
                        <InlineETA
                          variant={bookmark.type === 'stop' ? (variant ?? undefined) : undefined}
                          stop={stop}
                        />
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    removeBookmark(bookmark.id);
                  }}
                  className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="移除收藏"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
