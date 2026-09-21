export function getPagination(query) { const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); return { page, limit, skip: (page - 1) * limit }; }
export function paginationMeta({ page, limit, total }) { return { page, limit, total, totalPages: Math.ceil(total / limit) }; }
