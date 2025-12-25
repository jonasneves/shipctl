/**
 * Normalizes a URL by trimming whitespace and removing trailing slashes
 */
export function normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
}
