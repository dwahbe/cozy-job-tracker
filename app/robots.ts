import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Longest match wins: keep the social-preview images under /api/og/ crawlable
        // even though the rest of /api/ is not.
        allow: ['/', '/api/og/'],
        disallow: ['/admin', '/api/', '/b/', '/board', '/network', '/settings', '/oauth/'],
      },
    ],
    sitemap: 'https://cozyjobtracker.com/sitemap.xml',
  };
}
