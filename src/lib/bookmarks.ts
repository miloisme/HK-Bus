import { operatorMeta } from './operators';
import { variantId } from './operators/adapter';
import type { Company, RouteVariant, Stop } from './types';
import type { Bookmark } from './store';

const operatorName = (company: Company) => operatorMeta(company).nameTc;

export function routeBookmark(variant: RouteVariant): Bookmark {
  return {
    id: variant.id,
    type: 'route',
    company: variant.company,
    route: variant.route,
    ref: variant.ref,
    dir: variant.dir,
    name: `${variant.route} (${operatorName(variant.company)})`,
    subtitle: `往 ${variant.dest}`,
    orig: variant.orig,
    dest: variant.dest,
  };
}

export function stopBookmark(variant: RouteVariant, stop: Stop): Bookmark {
  return {
    id: `${variantId(variant.ref)}@${stop.stopId}`,
    type: 'stop',
    company: variant.company,
    route: variant.route,
    ref: variant.ref,
    dir: variant.dir,
    stopId: stop.stopId,
    name: stop.name,
    subtitle: `${variant.route} (${operatorName(variant.company)}) 往 ${variant.dest}`,
    orig: variant.orig,
    dest: variant.dest,
  };
}

export function stopOnlyBookmark(stop: Stop): Bookmark {
  return {
    id: `${stop.company}:${stop.stopId}`,
    type: 'stop-only',
    company: stop.company,
    route: '',
    stopId: stop.stopId,
    name: stop.name,
    subtitle: `所有到站路線 (${operatorName(stop.company)})`,
  };
}

/** 由收藏重建方向變體；資料不足時回傳 null */
export function bookmarkToVariant(bookmark: Bookmark): RouteVariant | null {
  const ref = bookmark.ref;
  if (!ref || ref.company !== bookmark.company) return null;

  return {
    id: variantId(ref),
    company: bookmark.company,
    route: bookmark.route,
    dir: bookmark.dir ?? 'outbound',
    orig: bookmark.orig ?? '',
    dest: bookmark.dest ?? '',
    ref,
  };
}

export function bookmarkToStop(bookmark: Bookmark): Stop | null {
  if (!bookmark.stopId) return null;
  return {
    company: bookmark.company,
    stopId: bookmark.stopId,
    name: bookmark.name,
    seq: 0,
  };
}
