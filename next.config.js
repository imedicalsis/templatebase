
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true
  },
  images: {
    domains: ["lh3.googleusercontent.com", "vercel.com"],
  }
};

module.exports = nextConfig;
