import { useEffect, useState } from 'react';

export interface NominatimResult {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Debounced address/place search via OpenStreetMap Nominatim (free, no API key).
 * Used by the MapPicker virtual-location search bar (NNNN). Honors Nominatim's
 * usage policy: ≥1s between requests (450ms debounce + only fires at ≥3 chars),
 * limit=5, and a descriptive User-Agent.
 */
export function useNominatimSearch(query: string): { results: NominatimResult[]; loading: boolean } {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`;
        const r = await fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'Meyou/1.0 (hello@meyou.uk)' },
        });
        const data = await r.json();
        if (cancelled) return;
        const out: NominatimResult[] = (Array.isArray(data) ? data : [])
          .map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: String(d.display_name ?? '') }))
          .filter((x: NominatimResult) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
        setResults(out);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  return { results, loading };
}
