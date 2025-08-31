import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Generate unique ID function
function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Node ID extension
export const NodeIdExtension = Extension.create({
  name: 'nodeId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading', 
          'blockquote',
          'codeBlock',
          'horizontalRule',
          'listItem',
          'bulletList',
          'orderedList',
          'table',
          'tableRow',
          'tableCell',
          'tableHeader'
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('id'),
            renderHTML: attributes => {
              if (!attributes.id) {
                return {}
              }
              return {
                id: attributes.id,
              }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('nodeId'),
        appendTransaction: (transactions, oldState, newState) => {
          // Check if new nodes need ID added
          let tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            // If node has no ID, add one
            if (node.isBlock && !node.attrs.id) {
              const id = generateNodeId()
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id })
              modified = true
            }
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})