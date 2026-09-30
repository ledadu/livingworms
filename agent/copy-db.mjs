// Copies a SQLite database consistently, even while a server writes to it: node copy-db.mjs <from> <to>.
import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [from, to] = process.argv.slice(2);
if (!from || !to) throw new Error('usage: node copy-db.mjs <from> <to>');
rmSync(to, { force: true });
const database = new DatabaseSync(from, { readOnly: true });
database.prepare('VACUUM INTO ?').run(to);
database.close();
