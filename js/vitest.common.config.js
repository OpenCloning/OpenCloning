export const testConfig = {
  globals: true,
  environment: 'jsdom',
  setupFiles: '../../tests/setup.js',
  include: ['src/**/*.{test,spec}.{js,jsx}'],
  coverage: {
    provider: 'istanbul',
    reporter: ['json', 'html'],
    include: ['src/**/*.{js,jsx}'],
    exclude: [
      'src/**/*.{test,spec}.{js,jsx}',
      '**/*.test.{js,jsx}',
      '**/*.spec.{js,jsx}',
    ],
  }
}
