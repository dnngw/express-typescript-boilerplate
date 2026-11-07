import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Converts `page`/`limit` into Prisma's `skip`/`take`. */
export function toSkipTake({ page, limit }: PaginationQuery): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPaginationMeta(
  { page, limit }: PaginationQuery,
  total: number,
): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
