import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    nodePolyfills({
      // Bắt buộc bật buffer để MQTT hoạt động
      include: ['buffer', 'process', 'util', 'stream'], 
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  server: {
    proxy: {
      // Bất kỳ request nào bắt đầu bằng /api sẽ được chuyển hướng
      '/api': {
        target: 'https://demo.thingsboard.io',
        changeOrigin: true,
        secure: false, // Bỏ qua lỗi SSL nếu có
        rewrite: (path) => path // Giữ nguyên đường dẫn /api
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
