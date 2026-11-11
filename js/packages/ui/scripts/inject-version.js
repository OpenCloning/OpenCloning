#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const file = join(__dirname, '..', 'src', 'version.js');

const content = `// Version placeholder - replaced at publish time via prepack script
export const version = "${pkg.version}";
`;

writeFileSync(file, content, 'utf-8');
console.log(`✓ Injected version ${pkg.version}`);
