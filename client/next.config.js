/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Tắt tối ưu hóa cho các file worker
    config.optimization.minimize = false;

    // Cấu hình cho Web Workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Xử lý lỗi module compatibility
    config.resolve.alias = {
      ...config.resolve.alias,
      "@vanilla-extract/sprinkles/createUtils": require.resolve(
        "@vanilla-extract/sprinkles/createUtils"
      ),
    };

    return config;
  },
  // Tắt tối ưu hóa Terser
  swcMinify: false,
  // Cấu hình transpilePackages
  transpilePackages: ["@rainbow-me/rainbowkit", "@vanilla-extract/sprinkles"],
};

module.exports = nextConfig;
