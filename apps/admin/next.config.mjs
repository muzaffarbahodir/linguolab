/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — нужен для Docker (минимальный bundle для prod).
  // На Windows локально отключаем — Next пытается создавать symlink, что
  // требует Developer Mode или admin прав. CI (Linux) и Docker (Linux) — OK.
  output: process.platform === 'win32' ? undefined : 'standalone',

  // CDN-домен для статики (если будем выносить статику на CDN позже)
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://cdn-linguolab.muzaffarbahodir.uz' : undefined,

  experimental: {
    // Next 14: разрешаем серверные actions без размера-лимита по умолчанию
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },

  // За CF + nginx — поведение proxy headers
  poweredByHeader: false,
};

export default nextConfig;
