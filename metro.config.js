const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O expo-sqlite web carrega o motor via WebAssembly; sem registrar .wasm como
// asset, o Metro não resolve o arquivo e o bundle web nem constrói.
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

// expo-sqlite no web roda em WebAssembly (wa-sqlite) e exige que a página
// esteja cross-origin isolated. Sem estes headers o banco não abre no browser.
config.server = config.server || {};
const originalMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = originalMiddleware ? originalMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return base(req, res, next);
  };
};

module.exports = config;
