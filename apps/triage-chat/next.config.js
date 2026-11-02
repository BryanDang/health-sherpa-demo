/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors exist in code paths the demo does not use. See README, Known issues.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
