export type ListSortKey = 'recent' | 'distance' | 'age' | 'active';

interface Accessors<T> {
  distanceM?: (t: T) => number | null | undefined;
  dob?: (t: T) => string | null | undefined;
  lastActive?: (t: T) => string | null | undefined;
}

const distVal = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? Infinity : v);
const tsVal = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
const dobVal = (s: string | null | undefined) => (s ? new Date(s).getTime() : -Infinity);

/**
 * Sort a list of user-like items by the chosen key. 'recent' keeps the
 * server's order (already newest-first). Missing values sort last:
 *   distance → nearest first (no distance → last)
 *   age      → youngest first (latest dob; no dob → last)
 *   active   → most recently active first (no timestamp → last)
 */
export function sortList<T>(items: T[], key: ListSortKey, acc: Accessors<T>): T[] {
  if (key === 'recent' || !items?.length) return items;
  const arr = [...items];
  if (key === 'distance') {
    arr.sort((a, b) => distVal(acc.distanceM?.(a)) - distVal(acc.distanceM?.(b)));
  } else if (key === 'age') {
    arr.sort((a, b) => dobVal(acc.dob?.(b)) - dobVal(acc.dob?.(a)));
  } else if (key === 'active') {
    arr.sort((a, b) => tsVal(acc.lastActive?.(b)) - tsVal(acc.lastActive?.(a)));
  }
  return arr;
}
