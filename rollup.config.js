const node = require('rollup-plugin-node-resolve');
module.exports = {
  entry: 'index.js',
  dest: 'dist/smart-table-vanilla.js',
  format: 'umd',
  plugins: [node({jsnext: true})],
  moduleName: 'smart-table-vanilla',
  sourceMap: true
};
