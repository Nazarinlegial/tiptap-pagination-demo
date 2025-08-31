import React from 'react'
import { FileText, Mail, Github } from 'lucide-react'
import MultiEditorPagination from './components/MultiEditorPagination'

const App: React.FC = () => {
  const openGitHub = () => {
    window.open('https://github.com/Cassielxd/tiptap-pagination-demo', '_blank')
  }

  const openEmail = () => {
    window.location.href = 'mailto:348040933@qq.com'
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="title-section">
            <div className="flex flex-col gap-1">
              <h1 className="app-title">
                <FileText className="title-icon" size={24} />
                Tiptap分页编辑器
              </h1>
              <p className="app-subtitle">模块化架构的智能分页富文本编辑器</p>
            </div>
          </div>
          
          <div className="action-section">
            <div className="flex items-center gap-4">
              <button 
                className="header-btn"
                onClick={openGitHub}
              >
                <Github size={16} />
                GitHub
              </button>
              
              <button 
                className="header-btn"
                onClick={openEmail}
              >
                <Mail size={16} />
                联系我们
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="editor-container">
          <MultiEditorPagination />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-600">
              Built with ❤️ using React, TypeScript, Tiptap & Tailwind CSS
            </p>
            
            <p className="text-xs text-gray-400">
              © 2025 Editor Plus
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App