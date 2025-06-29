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

    // Xử lý lỗi module compatibility - sử dụng dynamic import thay vì require
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    // Khắc phục lỗi ES Module với wallet connect
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        "@walletconnect/ethereum-provider":
          "commonjs @walletconnect/ethereum-provider",
        "@reown/appkit": "commonjs @reown/appkit",
      });
    }

    return config;
  },
  // Tắt tối ưu hóa Terser
  swcMinify: false,
  // Cấu hình transpilePackages
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "@vanilla-extract/sprinkles",
    "@walletconnect/ethereum-provider",
    "@reown/appkit",
  ],
  // Thêm cấu hình experimental để hỗ trợ ES modules
  experimental: {
    esmExternals: "loose",
  },
};

export default nextConfig;
