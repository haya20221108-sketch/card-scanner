/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development' // 開発環境では無効化
});

const nextConfig = {
  // 既存の設定...
};

module.exports = withPWA(nextConfig);
