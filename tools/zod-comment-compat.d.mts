import type { Plugin } from 'vite';
export function normalizeZodComment(code: string, id: string): { code: string; map: null } | null;
export function zodCommentCompat(): Plugin;
