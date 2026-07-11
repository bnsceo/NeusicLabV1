type QueryValue = string | number | null | undefined;

export function readNumericQueryParam(search: string, key: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get(key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildQueryString(params: Record<string, QueryValue>): string {
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    nextParams.set(key, String(value));
  }
  const query = nextParams.toString();
  return query ? `?${query}` : '';
}

export function buildShareableUrl(pathname: string, params: Record<string, QueryValue>): string {
  return `${pathname}${buildQueryString(params)}`;
}
