const node = require('rollup-plugin-node-resolve');
module.exports = {
  input: 'example/index.js',
  output: {
    file: 'example/bundle.js',
    format: 'iife',
    name: 'tableExample',
    sourcemap: 'inline',
  },
  plugins: [
    node({mainFields: ['browser', 'main']}),
  ],
};
