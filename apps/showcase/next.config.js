/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "1";

// GitHub Pages serves at https://<user>.github.io/<repo>/, so basePath must
// match the repo name for assets + links to resolve correctly. When building
// for local dev (`pnpm dev` on :3010) we drop the basePath so URLs are flat.
const BASE_PATH = isStaticExport ? "/heuresys-advanced" : "";

module.exports = {
  reactStrictMode: true,
  transpilePackages: ["@heuresys/ui"],
  eslint: { ignoreDuringBuilds: true },
  basePath: BASE_PATH,
  // Expose to the runtime so consumer code can build links with the right prefix.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  ...(isStaticExport && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};
