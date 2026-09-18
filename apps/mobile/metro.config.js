// Metro doit voir au-delà d'apps/mobile pour importer la source de vérité des
// tokens (`../../packages/shared/design-tokens.json`), conformément à
// CLAUDE.md / DESIGN_SYSTEM.md : jamais de duplication des couleurs à la main.
// On ne surveille que `packages/` (et pas tout le dépôt) pour éviter de faire
// entrer apps/web ou backend dans le graphe de modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../../packages');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [packagesRoot];

module.exports = config;