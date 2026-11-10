import react from '@vitejs/plugin-react';

export default () => {
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '127.0.0.1',
    },
    build: {
      outDir: 'build',
      cssMinify: 'esbuild',
    },
  };
};
