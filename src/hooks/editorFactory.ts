// Editor creation and configuration related utility functions

import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { NodeIdExtension } from '../extensions/NodeIdExtension'

// Editor configuration options
export interface EditorConfig {
  content?: any
  isPreloaded?: boolean
  onUpdate?: (editor: any) => void
  onSelectionUpdate?: (editor: any) => void
  onCreate?: (editor: any) => void
}

// Generate unique editor ID
export const generateEditorId = (): string => {
  return `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Create editor instance
export const createEditorInstance = (config: EditorConfig): any => {
  const editorId = generateEditorId()
  
  const editor = new Editor({
    content: config.content || '<p></p>',
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      NodeIdExtension,
    ],
    editorProps: {
      attributes: {
        class: 'editor-content-area',
        'data-editor-id': editorId,
      },
    },
    onCreate: ({ editor }) => {
      if (config.isPreloaded) {
      }
      config.onCreate?.(editor)
    },
    onUpdate: ({ editor }) => {
      config.onUpdate?.(editor)
    },
    onSelectionUpdate: ({ editor }) => {
      config.onSelectionUpdate?.(editor)
    }
  })
  
  ;(editor as any).editorId = editorId
  return editor
}

// Get editor ID
export const getEditorId = (editor: any): string => {
  return (editor as any).editorId
}

// Set editor content (safe way)
export const setEditorContentSafely = (editor: any, content: any): void => {
  if (content !== '<p></p>' && typeof content === 'object') {
    editor.commands.setContent('<p>Loading...</p>')
    
    setTimeout(() => {
      editor.commands.setContent(content)
    }, 10)
  } else {
    editor.commands.setContent(content)
  }
}

// Clear editor content
export const clearEditorContent = (editor: any): void => {
  editor.commands.setContent('<p></p>')
}

// Activate editor (set as editable)
export const activateEditor = (editor: any): void => {
  editor.setOptions({ editable: true })
}

// Deactivate editor (set as non-editable)
export const deactivateEditor = (editor: any): void => {
  editor.setOptions({ editable: false })
}