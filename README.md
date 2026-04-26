# nearley-newick

Newick tree format parser using Nearley.js. The primary API is intended for JavaScript modules, with a small CLI available for workflows that read a tree from a file path.

This package is ESM-only.

## Install

```bash
pnpm add nearley-newick
```

## Module Usage

```js
import { newickToAST, newickToJSON } from "nearley-newick";

const graph = newickToJSON("(A,B,(C,D)E)F;");
const ast = newickToAST("(A,B,(C,D)E)F;");
```

`newickToJSON` returns a graph-shaped object:

```js
{
  nodes: [
    {
      id: '...',
      type: 'leaf',
      nodeMetadata: {
        name: 'A',
        edge_length: ''
      }
    }
  ],
  edges: [
    {
      id: 'parentId:childId',
      dir: 'uni',
      weight: ''
    }
  ]
}
```

Invalid Newick input throws `NewickParseError`.

## CLI Usage

```bash
npx nearley-newick --help
npx nearley-newick path/to/tree.nwk
npx nearley-newick --pretty path/to/tree.nwk
npx nearley-newick --ast path/to/tree.nwk
```

The default CLI output is compact graph JSON from `newickToJSON`. Use `--pretty` to format the JSON and `--ast` to output the raw parser AST.

## Development

```bash
pnpm install
pnpm run compile
pnpm test
```

Edit `lib/newick_grammar.ne` and run `pnpm run compile` to regenerate `lib/newick_grammar.cjs`.

## Folder Structure

```bash
├── bin
│   └── nearley-newick.js # CLI entry point
├── lib
│   ├── newick_grammar.ne  # Nearley grammar source
│   ├── newick_grammar.cjs # generated parser from `pnpm run compile`
│   ├── index.js           # public module API
│   ├── index.d.ts         # public TypeScript declarations
│   ├── parser.js          # Newick parser implementation
│   └── grammar.js         # ESM wrapper around generated grammar
```
