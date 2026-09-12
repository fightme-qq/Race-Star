import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  server: { port: 3211, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
})
