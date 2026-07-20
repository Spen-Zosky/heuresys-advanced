/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // @heuresys/shared is consumed as its compiled dist (exports default -> ./dist/*.js)
  // so Turbopack resolves real .js files (D-58). Only @heuresys/ui still needs transpiling.
  transpilePackages: ["@heuresys/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@heuresys/ui"],
  },
  // Proxy /api/* to the Fastify API on :3001 so cookies (HttpOnly, SameSite=Lax)
  // remain same-origin and CSRF double-submit works without CORS preflights.
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_PROXY_BASE_URL || "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${base}/:path*` }];
  },
};
