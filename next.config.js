/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statický export do složky out/ – Wedos webhosting neumí Node.js,
  // aplikace běží celá v prohlížeči a backend je Convex v cloudu.
  output: "export",
  // Aplikace běží na https://www.sdhbor.cz/pokladna/
  basePath: "/pokladna",
  trailingSlash: true,
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  devIndicators: false,
};

module.exports = nextConfig;
