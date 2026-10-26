import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({command,mode}) => ({
  plugins: [react(), ...(command==='build'?[{
    name:'launcher-content-security-policy',
    transformIndexHtml:()=>[{
      tag:'meta',injectTo:'head-prepend' as const,attrs:{'http-equiv':'Content-Security-Policy',content:
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src "+(mode==='map-preview'?'http://127.0.0.1:43880':'https://mc.sotocoming.ru')}
    }]
  }]:[])],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
