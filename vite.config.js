import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login/index.html'),
        home: resolve(__dirname, 'home/home.html'),
        share: resolve(__dirname, 'share/index.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
});
