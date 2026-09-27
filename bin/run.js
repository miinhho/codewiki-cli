#!/usr/bin/env node
import { flush, run } from '@oclif/core'
import { CodeWikiError } from '../dist/wiki/errors.js'

try {
  await run(process.argv.slice(2), import.meta.url)
} catch (error) {
  const known =
    error instanceof CodeWikiError ||
    (error instanceof Error && error.name === 'CodeWikiError' && 'code' in error)
  const code = known ? error.code : 'CLI_ERROR'
  const message = error instanceof Error ? error.message : String(error)

  process.stderr.write(`${JSON.stringify({ error: { code, message } })}\n`)
  process.exitCode = 1
} finally {
  await flush()
}
