import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-700.css'
import '@fontsource/rubik/latin-800.css'
import '@fontsource/rubik/latin-900.css'
import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { PreviewBanner, Spinner, ToastProvider } from './components/ui'
import { IS_PREVIEW } from './lib/backend'
import Home from './pages/public/Home'
import Legal from './pages/public/Legal'

const AdminApp = lazy(() => import('./pages/admin/AdminApp'))
const Router = IS_PREVIEW ? MemoryRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <Router>
        {IS_PREVIEW && <PreviewBanner />}
        <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-paper"><Spinner className="h-8 w-8" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/regulamento" element={<Legal page="regulamento" />} />
            <Route path="/privacidade" element={<Legal page="privacidade" />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  </React.StrictMode>,
)
