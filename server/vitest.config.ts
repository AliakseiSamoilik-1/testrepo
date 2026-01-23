import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.[jt]s?(x)'],
    exclude: [
      'node_modules',
      'dist',
      'cypress',
      'test-int/**', // Exclude the integration test folder
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*'
    ]
  }
});
