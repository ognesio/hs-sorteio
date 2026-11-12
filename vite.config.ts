import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:preview` gera um único HTML de pré-visualização (dados fictícios, sem banco).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  build: mode === 'preview' ? { outDir: 'dist-preview', assetsInlineLimit: 100_000_000 } : { outDir: 'dist' },
}))
