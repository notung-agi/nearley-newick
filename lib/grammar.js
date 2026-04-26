import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const newickGrammar = require('./newick_grammar.cjs');

export default newickGrammar;