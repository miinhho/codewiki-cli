import { chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig } from 'tsup'

const outDir = '.agents/skills/codewiki-cli/cli'

export default defineConfig({
  entry: {
    'bin/run': 'bin/run.js',
    'dist/commands/cache': 'src/commands/cache.ts',
    'dist/commands/content': 'src/commands/content.ts',
    'dist/commands/search': 'src/commands/search.ts',
    'dist/commands/sections': 'src/commands/sections.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outDir,
  clean: true,
  bundle: true,
  noExternal: ['@oclif/core', 'marked', 'zod'],
  splitting: true,
  minify: true,
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  onSuccess: async () => {
    const source = JSON.parse(await readFile('package.json', 'utf8')) as {
      name: string
      version: string
      description: string
      oclif: unknown
    }
    const manifest = {
      name: source.name,
      version: source.version,
      description: source.description,
      type: 'module',
      bin: { codewiki: './bin/run.js' },
      oclif: source.oclif,
    }

    await writeFile(join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await chmod(join(outDir, 'bin/run.js'), 0o755)
  },
})
