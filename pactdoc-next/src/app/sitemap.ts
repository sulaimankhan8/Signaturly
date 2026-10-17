import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pactdoc.com";

  // Static marketing routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/verify`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/t`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Common legal templates
  const templateSlugs = [
    "non-disclosure-agreement",
    "independent-contractor-agreement",
    "software-development-agreement",
    "employment-offer-letter",
    "consulting-services-agreement",
    "mutual-confidentiality-agreement",
  ];

  const templateRoutes: MetadataRoute.Sitemap = templateSlugs.map((slug) => ({
    url: `${baseUrl}/t/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...templateRoutes];
}
