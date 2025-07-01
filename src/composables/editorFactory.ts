// 编辑器创建和配置相关的工具函数

import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'

// 编辑器配置选项
export interface EditorConfig {
  content?: any
  isPreloaded?: boolean
  onUpdate?: (editor: any) => void
  onSelectionUpdate?: (editor: any) => void
  onCreate?: (editor: any) => void
}

// 生成唯一的编辑器ID
export const generateEditorId = (): string => {
  return `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 创建编辑器实例
export const createEditorInstance = (config: EditorConfig): any => {
  const editorId = generateEditorId()
  
  const editor = new Editor({
    content: config.content || '<p></p>',
    extensions: [
      StarterKit,
      TextStyle,
      Color,
    ],
    editorProps: {
      attributes: {
        class: 'editor-content-area',
        'data-editor-id': editorId,
      },
    },
    onCreate: ({ editor }) => {
      if (config.isPreloaded) {
        console.log(`预创建编辑器实例已创建`)
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

// 获取编辑器ID
export const getEditorId = (editor: any): string => {
  return (editor as any).editorId
}

// 设置编辑器内容（安全方式）
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

// 清空编辑器内容
export const clearEditorContent = (editor: any): void => {
  editor.commands.setContent('<p></p>')
}

// 激活编辑器（设为可编辑）
export const activateEditor = (editor: any): void => {
  editor.setOptions({ editable: true })
}

// 停用编辑器（设为不可编辑）
export const deactivateEditor = (editor: any): void => {
  editor.setOptions({ editable: false })
} 