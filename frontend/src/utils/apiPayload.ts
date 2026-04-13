const DEFAULT_ARRAY_KEYS = [
  'data',
  'rows',
  'items',
  'users',
  'artworks',
  'events',
  'payments',
  'settings',
  'types',
  'results',
];

export function normalizeArrayPayload<T>(payload: unknown, extraKeys: string[] = []): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const obj = payload as Record<string, unknown>;
  const keysToCheck = [...extraKeys, ...DEFAULT_ARRAY_KEYS];

  for (const key of keysToCheck) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}
