// Paginasi seragam untuk semua endpoint daftar: ?page=1&limit=20, limit maksimal 50.
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

export function parsePagination(query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawPage = Number.parseInt(query.page, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : Math.min(defaultLimit, maxLimit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { page, limit, offset: (page - 1) * limit };
}

/** Bentuk respons daftar: { items, total, page, limit } */
export const paged = (items, total, { page, limit }) => ({ items, total: Number(total), page, limit });
