import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TypeScriptのエラーを無視してビルドを続行する
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLintのエラーを無視してビルドを続行する
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 🌟 画像エラーを解決するための設定を追加
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.usercontent.google.com',
      }
    ],
  },
};

export default withPWA(nextConfig);