/**
 * Headers for media the UI shows inline (uploaded screenshots, logo previews, generated images and videos): the browser
 * must not sniff another type, must not run anything in the file, and must not keep a copy (#64).
 */
export function safeMediaHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
    'cache-control': 'no-store',
  };
}
