import { describe, it, expect } from 'vitest';
import { parsePagination, paged, MAX_LIMIT } from '../../utils/pagination.js';

describe('parsePagination', () => {
  it('default page 1 limit 20', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it(`membatasi limit maksimal ${MAX_LIMIT}`, () => {
    expect(parsePagination({ limit: '1000' }).limit).toBe(50);
  });

  it('mengabaikan nilai tidak valid', () => {
    expect(parsePagination({ limit: '-5', page: 'abc' })).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(parsePagination({ limit: '0', page: '0' })).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('menghitung offset', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('paged() menghasilkan bentuk { items, total, page, limit }', () => {
    expect(paged([1], '7', { page: 2, limit: 5 })).toEqual({ items: [1], total: 7, page: 2, limit: 5 });
  });
});
