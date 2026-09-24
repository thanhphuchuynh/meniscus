/** A site URL that works both at the dev root and under GitHub Pages' project path. */
export function sitePath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
