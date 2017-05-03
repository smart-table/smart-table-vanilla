const node = require('rollup-plugin-node-resolve');
module.exports = {
  entry: 'example/index.js',
  dest: 'example/bundle.js',
  format: 'iife',
  plugins: [node({jsnext: true})],
  moduleName: 'tableExample',
  sourceMap: 'inline'
};
