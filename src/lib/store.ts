import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, Direction, VariantRef } from './types';
import { variantId } from './operators/adapter';

export type BookmarkType = 'route' | 'stop' | 'stop-only';

export interface Bookmark {
  id: string;
  type: BookmarkType;
  company: Company;
  /** 顯示用路線號碼；stop-only 為空字串 */
  route: string;
  name: string;
  subtitle?: string;
  orig?: string;
  dest?: string;
  /** 指向特定方向的句柄，缺省時代表只記住車站 */
  ref?: VariantRef;
  dir?: Direction;
  stopId?: string;
}

interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}

/**
 * 把舊格式（route/bound/serviceType/routeId 分開存）搬到新的 ref 結構。
 * 舊版 localStorage 沒有 migrate 機制，欄位一改所有人收藏就壞掉。
 */
function migrateBookmark(raw: Record<string, unknown>): Bookmark | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  const company = raw.company as Company;
  if (!id || !company) return null;

  const bookmark: Bookmark = {
    id,
    type: (raw.type as BookmarkType) ?? 'route',
    company,
    route: typeof raw.route === 'string' ? raw.route : '',
    name: typeof raw.name === 'string' ? raw.name : '',
  };

  if (typeof raw.subtitle === 'string') bookmark.subtitle = raw.subtitle;
  if (typeof raw.orig === 'string') bookmark.orig = raw.orig;
  if (typeof raw.dest === 'string') bookmark.dest = raw.dest;
  if (typeof raw.stopId === 'string') bookmark.stopId = raw.stopId;
  if (raw.dir === 'inbound' || raw.dir === 'outbound') bookmark.dir = raw.dir;

  const bound = typeof raw.bound === 'string' ? raw.bound : undefined;
  const serviceType = typeof raw.serviceType === 'string' ? raw.serviceType : undefined;
  const legacyRouteId = typeof raw.routeId === 'string' ? raw.routeId : undefined;

  if (bookmark.type === 'stop-only') return bookmark;

  if (company === 'NLB' && legacyRouteId) {
    bookmark.ref = { company: 'NLB', routeId: legacyRouteId };
  } else if (company === 'GMB') {
    return bookmark;
  } else if (bookmark.route && bound) {
    bookmark.ref =
      company === 'KMB'
        ? { company: 'KMB', route: bookmark.route, bound: bound as 'I' | 'O', serviceType: serviceType ?? '1' }
        : { company: 'CTB', route: bookmark.route, bound: bound as 'I' | 'O' };
  } else {
    return bookmark;
  }

  // 舊 id 是用欄位字串拼的，改用 variantId 讓同一個目標不會出現兩筆
  return { ...bookmark, id: bookmark.ref ? variantId(bookmark.ref) : id };
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
          bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== id),
        })),
      isBookmarked: (id) => get().bookmarks.some((bookmark) => bookmark.id === id),
    }),
    {
      name: 'hk-bus-bookmarks',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { bookmarks?: unknown[] } | undefined;
        const raw = state?.bookmarks;
        if (version < 2 && Array.isArray(raw)) {
          const migrated = raw
            .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map(migrateBookmark)
            .filter((bookmark): bookmark is Bookmark => bookmark !== null);
          return { bookmarks: migrated };
        }
        return state as { bookmarks: Bookmark[] };
      },
    },
  ),
);
