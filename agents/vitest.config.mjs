// The tests of the framework on their own (npm test in this folder): the project that mounts the folder runs them
// through its own vitest config instead (include agents/**/test/**/*.test.ts). Either way they read
// test/fixture.config.mjs, not the project's settings.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['agent/test/**/*.test.ts', 'release/test/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
