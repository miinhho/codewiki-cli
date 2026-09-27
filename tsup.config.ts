import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/commands/*.ts', 'src/wiki/*.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  bundle: false,
  dts: false,
})
