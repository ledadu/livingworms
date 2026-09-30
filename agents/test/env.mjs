// Imported first by every test of the framework: its modules then read the settings of test/fixture.config.mjs, not
// those of the project the folder is mounted in (config.mjs reads AGENTS_CONFIG when it is first imported). The
// processes the tests start inherit it.
import { fileURLToPath } from 'node:url';

process.env.AGENTS_CONFIG = fileURLToPath(new URL('./fixture.config.mjs', import.meta.url));
