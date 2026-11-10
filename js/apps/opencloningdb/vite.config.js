import react from '@vitejs/plugin-react';
import istanbul from 'vite-plugin-istanbul';
import { resolve } from 'path';

export default () => ({
  plugins: [
    react(),
    (process.env.VITE_COVERAGE) && istanbul({
      include: [
        'packages/*/src/**/*',
        'apps/*/src/**/*'
      ],
      extension: ['.js', '.jsx'],
      cwd: resolve(import.meta.dirname, '../..'),
    }),
  ],
  server: {
    port: 3000,
    host: '127.0.0.1'
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-redux',
      '@mui/material',

    ],
    rolldownOptions: {
      moduleTypes: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'build',
    cssMinify: 'esbuild',
  },
});
