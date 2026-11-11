import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: '../../tests/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
