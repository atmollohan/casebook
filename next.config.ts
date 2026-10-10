import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` writes to .next-dev and `next build` writes to .next. Sharing one
  // directory between the dev server and the production build corrupts the dev server's
  // chunk manifest — it serves a build it did not write and fails at runtime with
  // "Cannot find module './vendor-chunks/...'" on whichever page imported a dependency
  // the other build happened not to split out. `npm run verify` ends in a build, so this
  // collision is guaranteed rather than occasional.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Emit a self-contained server bundle at `.next/standalone` for the container image and for
  // git-first/Pi deployment. `next start` keeps working unchanged; this only adds an output.
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
