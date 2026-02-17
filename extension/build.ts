import { cp, mkdir } from 'fs/promises';

await mkdir('dist', { recursive: true });

// Build TypeScript → JS
const result = await Bun.build({
  entrypoints: ['src/popup.ts'],
  outdir: 'dist',
  target: 'browser',
  minify: true,
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy static files (html, css, manifest, icons)
await cp('public', 'dist', { recursive: true });

console.log('Build complete! Load extension/dist in chrome://extensions');
