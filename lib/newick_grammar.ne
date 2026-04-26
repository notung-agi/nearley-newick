@builtin "whitespace.ne" # `_` arbitrary amount of whitespace
@builtin "number.ne"     # `int`, `decimal`, and `percentage` number primitives
@builtin "string.ne"     # `dqstring`, `sqstring`, `btstring`, `dstrchar`, `sstrchar`, `strescape`

TreeWithRoot -> Tree
  {%
    data => {
      // console.log("TreeWithRoot -> Tree")
      
      // Update root node with id, since that id is not created with Node -> NodeProps
      for (const i in data[0][0]) {
        // console.log(i, data[0][0][i]);
        if (typeof data[0][0][i] !== 'string' && !Array.isArray(data[0][0][i]) &&  'nodeMetadata' in data[0][0][i]) {
          const aguid = require('aguid');
          data[0][0][i] = { id: aguid(), ...data[0][0][i] };
        }
      }      
      return data[0];
    }
  %}

Tree -> 
    Subtree ";"

# 
# Tree -> 
#     RootLeaf ";" 
#       {% 
#         data => {
#           // console.log("Root at leaf");
#           // for (node of data[0]) {
#           //   if (typeof node !== 'string' && !Array.isArray(node) && 'nodeMetadata' in node) {
#           //     const aguid = require('aguid');
#           //     node = { id: aguid(), ...node.nodeMetadata };
#           //   }
#           // }
#           return data;
#           // return [...data[0], data[1]]
#         }
#       %}
#   | RootInternal ";"
#     {% 
#       data => {
#         // console.log("Root at internal");
#         // console.log(data[0])
#         // for (node of data[0]) {
#         //   if (typeof node !== 'string' && !Array.isArray(node) &&  'nodeMetadata' in node) {
#         //     const aguid = require('aguid');
#         //     node = { id: aguid(), ...node.nodeMetadata };
#         //   }
#         // }
#         return data
#         // return [...data[0], data[1]]
#       }
#     %}
# 
# RootLeaf ->
#     Node
#       {%
#         data => {
#           // console.log("RootLeaf -> Node");
#           // console.log(data)
#           return data;
#         }
#       %}
#   | "(" Branch ")" Node 
#     {%
#       data => {
#         // console.log("RootLeaf -> ( Branch Node )");
#         // console.log(data)
#         return data;
#       }
#     %}
# 
# RootInternal ->
#     "(" Branch "," BranchSet ")" Node
#       {%
#         data => {
#           // console.log("RootLeaf -> ( Branch , BranchSet ) Node");
#           // console.log(data)
#           // return data;
#           return [data[0], data[1], data[2], ...data[3], data[4], data[5]];
#         }
#       %}

BranchSet ->
    Branch 
      {%
        data => {
          // console.log("BranchSet -> Branch")
          // console.log(JSON.stringify(data));
          return data;
        }
      %}
  | Branch "," BranchSet
      {% 
        data => {
          // console.log(`BranchSet -> Branch "," BranchSet`)
          // console.log(JSON.stringify(data));
          // return [data[0], data[1], data[2][0]];
          return [data[0], data[1], data[2]];
        }
      %}

Branch -> 
    Subtree
      {% 
        data => { 
          return data[0]; 
        }
      %}


Subtree ->
    Leaf {% 
      data => { 
        return [data];
      } 
    %}
  | Internal 
      {%
        data => {
          // console.log("Subtree");
          // console.log(data);
          return data
        }
      %}

Leaf -> 
    Node 
      {% 
        data => {
          const aguid = require('aguid');
          return { 
            id: aguid(data[0].nodeMetadata.name), 
            ...data[0], 
            type: "leaf" 
          };
        }
      %}

Internal -> 
    "(" BranchSet ")" Node
      {% 
        data => {
            // console.log("Internal > ( BranchSet ) Node");
            // console.log(data)
            const aguid = require('aguid');
            
            return [
              data[0], 
              data[1], 
              data[2], 
              { 
                id: aguid(data[3].nodeMetadata.name), 
                ...data[3], // metadata
                type: "internal" 
              }
            ];
            
        }
      %}

Node ->
    NodeProps
      {% 
        data => {
            const aguid = require('aguid');
            const node = { 
              nodeMetadata: { 
                name: data[0][0] ? data[0][0] : "name_" + aguid(), 
                ...data[0][1] 
              }
            }
            return node;
        }
      %}


NodeProps -> 
    OptionalString OptionalLength

OptionalString ->
    null {% data => { return null; } %}
  # | sqstring {% data => { return data[0] } %}
  | [a-zA-Z0-9\-\_]:+ {% data => { return data[0].join("") } %}


OptionalLength -> 
    null 
      {% 
        data => {
          return { edge_length: "" };
        }
      %}
  | ":" decimal 
      {%
        data => {
          return { edge_length: data[1].toString() }
        }
      %}


# {% 
#     data => {
#         console.log(data)
#         return data;
#     }
# %}