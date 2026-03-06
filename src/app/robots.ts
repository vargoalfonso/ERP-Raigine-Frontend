import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // This is an internal ERP UI; default to no indexing.
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
