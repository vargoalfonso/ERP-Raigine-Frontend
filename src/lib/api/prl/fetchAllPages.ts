/**
 * Loads every page of a paginated endpoint and returns all items, so callers
 * are not limited by a page size or by the backend's per-request cap.
 *
 * `fetchPage` returns one page plus the overall `total`; paging stops once all
 * items are collected, a page comes back empty, or `maxPages` is reached (a
 * safety net against a misbehaving `total`).
 */
export async function fetchAllPages<T>(
  fetchPage: (
    page: number,
    limit: number,
  ) => Promise<{ items: T[]; total: number }>,
  limit = 1000,
  maxPages = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { items, total } = await fetchPage(page, limit);
    all.push(...items);
    if (items.length === 0 || all.length >= total) break;
  }
  return all;
}
