import type { MetadataRoute } from "next";
import { SITE_URL } from "@/site/url";

// What search engines may read (/robots.txt): the website and the shops.
// Order pages (private links), the seller app, the admin, the styleguide and
// the development pages stay out of search results.
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/o/", "/m/", "/admin", "/styleguide", "/dev/"].flatMap((path) => [`/km${path}`, `/en${path}`]);
  return {
    rules: { userAgent: "*", allow: "/", disallow: privatePaths },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
