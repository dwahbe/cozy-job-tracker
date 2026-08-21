import type { MetadataRoute } from 'next';

const BASE = 'https://cozyjobtracker.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/changelog`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/data-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
