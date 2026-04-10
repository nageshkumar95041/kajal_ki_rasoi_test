import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/payment', '/my-orders', '/profile', '/tracking'],
      },
    ],
    sitemap: 'https://www.kajalkirasoi.com/sitemap.xml',
  };
}
