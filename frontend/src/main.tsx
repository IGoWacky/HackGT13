import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Auth from './Auth.tsx'
import DocUpdate from './DocUpdate.tsx'
import './theme.css'

const isDocUpdate = window.location.pathname.replace(/\/+$/, '') === '/docupdate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDocUpdate ? <DocUpdate /> : <Auth />}
  </StrictMode>,
)
