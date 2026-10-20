export function pageItems<T>(items: readonly T[], requestedPage: number, size = 40) {
  const perPage = Math.max(1, Math.floor(size) || 40);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.max(1, Math.min(pages, Math.floor(requestedPage) || 1));
  const start = (page - 1) * perPage;
  return { page, pages, rows: items.slice(start, start + perPage), first: items.length ? start + 1 : 0, last: Math.min(start + perPage, items.length) };
}
