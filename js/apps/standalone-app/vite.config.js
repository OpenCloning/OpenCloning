import react from '@vitejs/plugin-react';

export default () => {
  return {
    plugins: [react()],
    server: {
      port: 3001,
    },
  };
};
