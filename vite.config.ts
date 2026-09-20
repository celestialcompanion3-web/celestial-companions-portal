import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Top-level await is used to load the demo stand-in only in demo mode.
  build: { target: 'esnext' },
})
