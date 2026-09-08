import type { NextConfig } from "next";

/**
 * Media is shared with the FLVS storefront: one R2 bucket, one public
 * hostname, bran's objects under their own key prefix. Only the hostname
 * matters to the image optimiser, so it is the only thing declared here.
 */
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
  const r2 = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  remotePatterns.push({
    protocol: r2.protocol.replace(":", "") as "https" | "http",
    hostname: r2.hostname,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    // Uploads are immutable — an edit writes a new key rather than replacing
    // one — so a long TTL costs nothing in staleness and takes steady-state
    // re-optimisation of an unchanged library to zero.
    minimumCacheTTL: 2678400, // 31 days
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // Required from Next 16. Each quality is a separate transformation, so an
    // open list lets one stray `quality` prop double the bill.
    qualities: [75],
  },
};

export default nextConfig;
