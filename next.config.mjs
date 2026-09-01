/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Receipt photos are downscaled on the phone before upload, but
      // leave headroom for a big one taken on a newer camera.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
