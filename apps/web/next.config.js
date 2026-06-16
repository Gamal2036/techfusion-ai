/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@techfusion/ui', '@techfusion/config'],
};

module.exports = nextConfig;
