const node = require('rollup-plugin-node-resolve');
module.exports = {
  external: [
    'smart-table-core',
  ],
  input: 'index.js',
  output: {
    file: 'dist/smart-table-vanilla.js',
    format: 'umd',
    name: 'smart-table-vanilla',
    sourcemap: true,
  },
  plugins: [node()],
};
