import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate browser-test build output from an already running local dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
