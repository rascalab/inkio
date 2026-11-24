export default {
  plugins: {
    // Webpack resolves the Inkio public entries and their source-mode aliases.
    'postcss-import': { filter: id => !id.startsWith('@inkio/') },
  },
};
