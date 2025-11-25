/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.walletconnect.org https://*.walletlink.org",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.etherscan.io https://api.dexscreener.com https://api.coingecko.com https://api.baseapp.xyz https://mainnet.base.org https://*.base.org wss://www.walletlink.org wss://*.walletconnect.org wss://*.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com https://*.walletlink.org",
              "frame-src 'self' https://*.walletconnect.org",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

