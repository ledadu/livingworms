// The tests: the game's own (src/**/*.test.ts) and those of the agents framework (agents/), which read their own
// settings (agents/test/fixture.config.mjs), not agents.config.mjs.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'agents/**/test/**/*.test.ts'],
    // The agents run their checks side by side on one machine, where a test that takes a second alone may take ten:
    // the limit only has to catch a test that hangs (5 s by default).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
