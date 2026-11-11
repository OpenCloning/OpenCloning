#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file = join(__dirname, '..', 'src', 'version.js');

const content = `// Version placeholder - replaced at publish time via prepack script
export const version = "__VERSION__";
`;

writeFileSync(file, content, 'utf-8');
console.log('✓ Reset version placeholder');
