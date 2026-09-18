/**
 * Export statique (obligatoire pour l'encapsulation desktop via Tauri, voir
 * opencode.md). Aucune API route / server action / ISR : toute la logique vit
 * dans le backend FastAPI appelé en REST depuis le client.
 */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;