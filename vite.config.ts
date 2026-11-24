import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        islTest: fileURLToPath(new URL('./isl-test.html', import.meta.url)),
        ishaara: fileURLToPath(new URL('./ishaara/index.html', import.meta.url)),
        zerog: fileURLToPath(new URL('./zerog/index.html', import.meta.url)),
      },
    },
  },
})
