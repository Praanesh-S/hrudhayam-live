/**
 * Database utility for bypassing PostgREST's default 1,000-row server limit.
 *
 * PostgREST strictly enforces a maximum of 1,000 rows returned per single HTTP request.
 * When tables such as `passes`, `payments`, or `seats` exceed 1,000 rows, queries
 * without range-based pagination silently truncate at 1,000 items.
 *
 * This utility:
 * 1. Queries the first page (0..pageSize - 1) requesting { count: 'exact' }.
 * 2. If the total count is <= pageSize, returns immediately (single HTTP call).
 * 3. If total count > pageSize, executes parallel range queries for all remaining pages
 *    (e.g. 1000..1999, 2000..2999) and concatenates them in order.
 * 4. Provides a robust fallback loop if count is unavailable.
 */
export async function fetchAllPaginated<T = any>(
  queryFactory: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const firstRes = await queryFactory(0, pageSize - 1);
  if (firstRes.error) {
    console.error('fetchAllPaginated error on initial page:', firstRes.error);
    return [];
  }

  const firstData = (firstRes.data || []) as T[];
  if (firstData.length < pageSize) {
    return firstData;
  }

  const totalCount = typeof firstRes.count === 'number' ? firstRes.count : null;
  if (totalCount !== null && totalCount > pageSize) {
    const promises: Promise<any>[] = [];
    for (let from = pageSize; from < totalCount; from += pageSize) {
      promises.push(queryFactory(from, from + pageSize - 1));
    }
    const remainingPages = await Promise.all(promises);
    const allData = [...firstData];
    for (const page of remainingPages) {
      if (page.data) {
        allData.push(...page.data);
      }
    }
    return allData;
  }

  // Fallback sequential loop if total count was not returned
  const batches: T[][] = [firstData];
  let currentFrom = pageSize;
  while (true) {
    const nextRes = await queryFactory(currentFrom, currentFrom + pageSize - 1);
    if (nextRes.error || !nextRes.data || nextRes.data.length === 0) break;
    batches.push(nextRes.data as T[]);
    if (nextRes.data.length < pageSize) break;
    currentFrom += pageSize;
  }
  return batches.flat();
}
