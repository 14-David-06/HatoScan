import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El paquete de contratos se consume como TypeScript fuente.
  transpilePackages: ['@hatoscan/contracts'],
};

export default nextConfig;
