import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.kajalkirasoi.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://www.kajalkirasoi.com/subscription', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://www.kajalkirasoi.com/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: 'https://www.kajalkirasoi.com/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];
}
