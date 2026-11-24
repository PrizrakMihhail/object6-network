import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeSupabaseConfig } from './build-supabase-config.mjs';
import { puzzles } from '../src/g4/puzzles.js';

const root = new URL('../', import.meta.url);
const source = new URL('src/', root);
const templates = new URL('templates/g4/', root);
const output = fileURLToPath(new URL('dist', root));

async function buildMicroreader(directory) {
  const entries = await readdir(new URL('assets/microreader/', directory), { withFileTypes: true })
    .catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
  const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
  const slides = entries
    .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name))
    .map(entry => entry.name)
    .sort(collator.compare)
    .map((name, index) => ({
      src: 'assets/microreader/' + encodeURIComponent(name),
      title: name.replace(/\.[^.]+$/, '').replace(/^clipping-(\d+)$/i, 'ВЫРЕЗКА $1').replace(/[_-]+/g, ' '),
      caption: `АРХИВНАЯ КОПИЯ // ЛИСТ ${String(index + 1).padStart(2, '0')}`
    }));
  await writeFile(new URL('microreader/microreader-catalog.js', directory),
    `export default ${JSON.stringify(slides, null, 2)};\n`);
  console.log(`Microreader: ${slides.length} images`);
}

async function buildVaultPages(directory) {
  const template = await readFile(new URL('vault-page.html', templates), 'utf8');
  const pages = [
    {
      filename: 'secure.html', puzzle: 'history', content: 'history.html',
      pageTitle: 'G4 // Закрытый архив', accessTitle: 'ЗАКРЫТЫЙ АРХИВ', extraStyles: ''
    },
    {
      filename: 'letter.html', puzzle: 'dispatch', content: 'dispatch.html',
      pageTitle: 'G4 // Письмо Барона', accessTitle: 'ПИСЬМО БАРОНА',
      extraStyles: '<link rel="stylesheet" href="g4/baron-mail.css">'
    }
  ];

  for (const { filename, content, ...fields } of pages) {
    const { password, maxAttempts } = puzzles[fields.puzzle];
    const values = {
      ...fields,
      wordLength: password.length,
      attemptBlocks: Array(maxAttempts).fill('■').join(' '),
      vault: (await readFile(new URL(content, templates), 'utf8')).trim()
    };
    const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!Object.hasOwn(values, key)) throw new Error(`Unknown vault template field: ${key}`);
      return values[key];
    });
    await writeFile(new URL(filename, directory), html);
  }
}

const temporaryPath = await mkdtemp(fileURLToPath(new URL('.build-', root)));
const temporaryDirectory = pathToFileURL(temporaryPath + '/');
try {
  await cp(source, temporaryDirectory, { recursive: true });
  await writeSupabaseConfig(temporaryDirectory);
  await buildMicroreader(temporaryDirectory);
  await buildVaultPages(temporaryDirectory);
  await rm(output, { recursive: true, force: true });
  await rename(temporaryPath, output);
} finally {
  await rm(temporaryPath, { recursive: true, force: true });
}
