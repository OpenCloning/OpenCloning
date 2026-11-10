import { defineConfig } from 'cypress';
import fs from 'fs';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import registerCodeCoverageTasks from '@cypress/code-coverage/task';
import { clerkSetup } from '@clerk/testing/cypress';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';



export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        readFileMaybe(filename) {
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename,
              'utf8');
          }

          return null;
        },
        moveFile({ from, to }) {
          fs.renameSync(from, to);
          return null;
        },
      });
      if (process.env.VITE_COVERAGE) {
        try {
          console.log('Loading code coverage task for e2e');
          registerCodeCoverageTasks(on, config);
        } catch (error) {
          console.warn('Could not load code coverage task:', error.message);
        }
      }

      // Filter specs by test group if specified
      if (process.env.CYPRESS_TEST_GROUP) {
        config.specPattern = `cypress/e2e/group-${process.env.CYPRESS_TEST_GROUP}/**/*.cy.{js,jsx}`;
      }

      if (process.env.CYPRESS_TEST_GROUP === 'opencloningdb-clerk') {
        return clerkSetup({ config });
      }

      return config;
    },
    baseUrl: 'http://localhost:3000',
    numTestsKeptInMemory: 2
  },

  component: {
    specPattern: ['packages/**/*.cy.{js,jsx}', 'apps/**/*.cy.{js,jsx}'],
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: async () => {
        const istanbul = (await import('vite-plugin-istanbul')).default;
        return {
          mode: 'test',
          resolve: {
            alias: {
              '@opencloning/ui': resolve(import.meta.dirname, 'packages/ui/src'),
              '@opencloning/store': resolve(import.meta.dirname, 'packages/store/src'),
              '@opencloning/utils': resolve(import.meta.dirname, 'packages/utils/src/utils'),
              '@opencloning/opencloning-elabftw': resolve(import.meta.dirname, 'packages/opencloning-elabftw/src'),
            },
          },
          plugins: [
            (process.env.VITE_COVERAGE) && istanbul({
              include: [
                'packages/*/src/*',
                'apps/*/src/*'
              ],
              extension: ['.js', '.jsx'],
            }),
            ViteEjsPlugin({
              umami_website_id: process.env.VITE_UMAMI_WEBSITE_ID,
            }),
            react(),
          ],
          optimizeDeps: {
            include: [
              '@emotion/react', 
              '@emotion/styled', 
              '@mui/material/Tooltip',
              '@mui/material/Unstable_Grid2'
            ],
            entries: ['packages/**/*.cy.{js,jsx}', 'apps/**/*.cy.{js,jsx}', 'cypress/**/*.js'],
            exclude: ['fsevents'],
          },
          ssr: {
            noExternal: ['fsevents'],
          },
        };
      },
    },
    setupNodeEvents(on, config) {
      if (process.env.VITE_COVERAGE) {
        try {
          console.log('Loading code coverage task for component');
          registerCodeCoverageTasks(on, config);
        } catch (error) {
          console.warn('Could not load code coverage task:', error.message);
        }
      }
      return config;
    },
  },

  retries: {
    runMode: 2,
  },
});
