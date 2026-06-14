import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Company, Route } from './api';

export interface Bookmark {
  id: string;
  type: 'route' | 'stop' | 'stop-only';
  company: Company;
  route: string;
  routeId?: string; // NLB specific
  bound?: string; // KMB specific
  serviceType?: string; // KMB specific
  dir?: 'inbound' | 'outbound'; // CTB/KMB direction
  stopId?: string;
  name: string;
  subtitle?: string;
  orig?: string;
  dest?: string;
}

interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      addBookmark: (bookmark) => {
        if (!get().isBookmarked(bookmark.id)) {
          set((state) => ({ bookmarks: [...state.bookmarks, bookmark] }));
        }
      },
      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),
      isBookmarked: (id) => get().bookmarks.some((b) => b.id === id),
    }),
    {
      name: 'hk-bus-bookmarks',
    }
  )
);
