import nearley from 'nearley';
import { EventEmitter } from 'node:events';
import grammar from './grammar.js';

export class NewickParseError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'NewickParseError';
    }
}

function parser() {
    return new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
}

export function newickToAST(input) {
    if (typeof input !== 'string') {
        throw new TypeError('Newick input must be a string');
    }

    let nep = parser();

    try {
        nep.feed(input);
    } catch (error) {
        throw new NewickParseError('Invalid Newick input', { cause: error });
    }

    if (nep.results.length === 0) {
        throw new NewickParseError('Invalid Newick input: no parse result');
    }

    const uniqueResults = dedupeParseResults(nep.results);

    if (uniqueResults.length > 1) {
        throw new NewickParseError('Ambiguous Newick input: multiple parse results');
    }

    return uniqueResults[0];
}

export function newickToJSON(input) {
    const ast = newickToAST(input);
    const ast_nodes = ast[0]; // array of parent and direct children, `Tree` nonterminal in nearley  
    const ast_rootNote = ast_nodes[find_idx_of_parent_from_newick_treeArr(ast_nodes)]; // assumed to exist  
    
    // Collect ast into JSON nodes and edges format
    const nodes = [];
    const edges = [];
    let em = new EventEmitter();
    em.on('ParsedNode', function (data) { nodes.push(data); })
    em.on('ParsedEdge', function (data) { edges.push(data); })

    parse_newick_ast(em, [ast_nodes], ast_rootNote);

    return makeGraphDeterministic({ nodes, edges })
}

function parse_newick_ast(em, startingTreeArr, closestAncestorNode={}) {
    const treeArr = startingTreeArr[0];

    let newParentNodeInThisIteration = {}; // update if new internal node is found

    const edges = [];
    const nodes = []

    let subTreeArr = []; // polytomy at the actual tree can be represented as nested subTreeArr
    const idxOfSubTreeArrFromTreeArr = find_idx_of_children_from_newick_nodes(treeArr); 
    
    // console.debug('// treeArr:\n', JSON.stringify(treeArr))
    // console.debug(`\n//idxOfSubTreeArrFromTreeArr: ${idxOfSubTreeArrFromTreeArr} (out of max idx: ${treeArr.length-1})`);
    
    for (const i in treeArr) {
        // console.debug(`// testing ${i}:\n`, JSON.stringify(treeArr[i]));
        if (idxOfSubTreeArrFromTreeArr.includes(i)) {
            if (subTreeArr.length >= 2) {
                // TODO verify if this is true
                throw new Error("There cannot be more than array containing children");
            }
            // console.debug("// found child")
            subTreeArr.push([treeArr[i]]);
        }
        else if (newick_node_is_leaf(treeArr[i])) {
            // console.debug("// found leaf")
            const leafNode = newick_node_get_leaf(treeArr[i]);
            nodes.push(leafNode);
            if (closestAncestorNode.id) {
                edges.push({
                    id: closestAncestorNode.id + ":" + leafNode.id,
                    dir: "uni",
                    weight: leafNode.nodeMetadata.edge_length
                });
            }
        }
        else if (newick_node_is_internal(treeArr[i])) {
            // console.debug("// found internal node")
            nodes.push(treeArr[i])
            if (closestAncestorNode.id) {
                edges.push({
                    id: closestAncestorNode.id + ":" + treeArr[i].id,
                    dir: "uni",
                    weight: treeArr[i].nodeMetadata.edge_length
                })
            }
            // Set new parent to be passed off to next iteration
            newParentNodeInThisIteration = treeArr[i]
        }
        // else {
        //     // "(", ")", and ","
        //     console.debug("// found nothing")
        // }
    }
    // console.debug("// -- Loop end");

    // console.debug("// closestAncestorNode: ", JSON.stringify(closestAncestorNode));
    // console.debug("// newParentNodeInThisIteration: ", JSON.stringify(newParentNodeInThisIteration));
    // console.debug(`// edges: ${edges.length}`)
    // console.debug(`// subTreeArr: ${subTreeArr.length}`); // : \n`, JSON.stringify(subTreeArr));
    
    nodes.forEach((node) => {
        // console.debug("// node: ", JSON.stringify(node));
        em.emit('ParsedNode', node)
    });
    edges.forEach((edge) => {
        // edge.parentNodeId is undefined for root
        // if (edge.parentNodeId && 'parentNodeId' in edge) {
            // console.debug("// edge: ", JSON.stringify(edge));
            em.emit('ParsedEdge', edge)
        // }
    });

    if (subTreeArr.length === 0) {
        // base case
        // console.debug("// ---> reached terminal level")
        return;
    } 
    // recursive case
    let closestAncestorNodeForNextIteration;
    if ('id' in newParentNodeInThisIteration) {
        closestAncestorNodeForNextIteration = newParentNodeInThisIteration
    } else {
        closestAncestorNodeForNextIteration = closestAncestorNode
    }

    // TODO test stack blowing up for deep trees
    for (const i in subTreeArr) {
        // console.debug(`// Running Recursive ${JSON.stringify(subTreeArr[i])}`);
        parse_newick_ast(em, subTreeArr[i], closestAncestorNodeForNextIteration);
    }
    return;
}

function newick_node_is_polytomy(node) {
    // polytomy of subtrees are triple nested
    return (Array.isArray(node) 
            && node.length === 1 
            && Array.isArray(node.at(0)) && node.at(0).length === 1
            && Array.isArray(node.at(0).at(0)) && node.at(0).at(0).length !== 1
    )
}

function dedupeParseResults(results) {
    const seen = new Set();
    const uniqueResults = [];

    for (const result of results) {
        const key = JSON.stringify(normalizeGeneratedValues(result));

        if (!seen.has(key)) {
            seen.add(key);
            uniqueResults.push(result);
        }
    }

    return uniqueResults;
}

function normalizeGeneratedValues(value, key) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeGeneratedValues(item));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([entryKey, entryValue]) => [
                entryKey,
                normalizeGeneratedValues(entryValue, entryKey)
            ])
        );
    }

    if (key === 'id') {
        return '<generated-id>';
    }

    if (key === 'name' && typeof value === 'string' && value.startsWith('name_')) {
        return '<generated-name>';
    }

    return value;
}

function makeGraphDeterministic(graph) {
    let unnamedNodeCount = 0;
    const idByOriginalId = new Map();

    const nodes = graph.nodes.map((node, index) => {
        const name = node.nodeMetadata.name.startsWith('name_')
            ? `unnamed_${unnamedNodeCount++}`
            : node.nodeMetadata.name;
        const id = `node_${index}_${slugifyNodeId(name)}`;

        idByOriginalId.set(node.id, id);

        return {
            ...node,
            id,
            nodeMetadata: {
                ...node.nodeMetadata,
                name
            }
        };
    });

    const edges = graph.edges.map((edge) => {
        const [parentId, childId] = edge.id.split(':');

        return {
            ...edge,
            id: `${idByOriginalId.get(parentId)}:${idByOriginalId.get(childId)}`
        };
    });

    return { nodes, edges };
}

function slugifyNodeId(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return slug || 'unnamed';
}

function newick_node_is_leaf(node) {
    return (Array.isArray(node) 
            && node.length === 1 
            && Array.isArray(node.at(0)) && node.at(0).length === 1
            && 'nodeMetadata' in node[0][0])
}

function newick_node_get_leaf(node) {
    // check newick_node_is_leaf() before calling
    return node[0][0];
}

function newick_node_is_internal(node) {
    return (typeof node !== 'string' 
        && !Array.isArray(node) 
        && 'nodeMetadata' in node)
}

function find_idx_of_parent_from_newick_treeArr(astNodeArr) {
    for (const i in astNodeArr) {
        if (typeof astNodeArr[i] !== 'string' // skip : ( , ) ;
            && !Array.isArray(astNodeArr[i]) // array is subtree
            && 'nodeMetadata' in astNodeArr[i]
        ) {
            return i
        }
    }
}

function find_idx_of_children_from_newick_nodes(astNodeArr) {
    const childrenIdxArr = [];
    for (const i in astNodeArr) {
        if (typeof astNodeArr[i] !== 'string' // skip : ( , ) ;
        ) {
            if (!newick_node_is_leaf(astNodeArr[i]) && !newick_node_is_internal(astNodeArr[i])) {
                childrenIdxArr.push(i);
            }
        }
    }
    return childrenIdxArr
}