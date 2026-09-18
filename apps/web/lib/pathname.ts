// next.config.mjs force `trailingSlash: true` (requis pour l'export statique Tauri) :
// usePathname() renvoie donc toujours un slash final (ex. "/login/"), jamais "/login".
// Toute comparaison de route doit passer par cette normalisation.
export function normalizePathname(raw: string): string {
  return raw.length > 1 ? raw.replace(/\/$/, '') : raw;
}
