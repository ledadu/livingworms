// The tests: the game's own (src/**/*.test.ts) and those of the agents framework (agents/), which read their own
// settings (agents/test/fixture.config.mjs), not agents.config.mjs.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'agents/**/test/**/*.test.ts'],
  },
});
