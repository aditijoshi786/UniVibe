import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#0A0A0C',
            border: '2px solid #0A0A0C',
            borderRadius: '14px',
            boxShadow: '5px 5px 0 #00CED1',
            fontSize: '14px',
            fontWeight: 700,
          },
          success: { iconTheme: { primary: '#FF007F', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
