import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { CodeWikiError } from './errors.js'
import { wikiSnapshotSchema, type WikiSnapshot } from './model.js'

const cacheVersion = 3
const cachedWikiSchema = z.object({
  version: z.literal(cacheVersion),
  snapshot: wikiSnapshotSchema,
})
const configSchema = z.object({ directory: z.string().min(1) })
const cacheFileName = /^wiki-[a-f0-9]{64}\.json$/

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function configFile(): string {
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'codewiki-cli',
    'config.json',
  )
}

function defaultDirectory(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
  return isAbsolute(base) ? join(base, 'codewiki-cli') : resolve(base, 'codewiki-cli')
}

function cacheFile(repo: string, directory: string): string {
  const hash = createHash('sha256').update(repo.toLowerCase()).digest('hex')
  return join(directory, `wiki-${hash}.json`)
}

export async function getCacheDirectory(): Promise<string> {
  if (process.env.CODEWIKI_CACHE_DIR) return resolve(process.env.CODEWIKI_CACHE_DIR)

  const file = configFile()
  try {
    const data: unknown = JSON.parse(await readFile(file, 'utf8'))
    const config = configSchema.safeParse(data)
    if (!config.success)
      throw new CodeWikiError('CONFIG_IO', `Invalid cache configuration: ${file}`, {
        cause: config.error,
      })

    return config.data.directory
  } catch (error) {
    if (isMissing(error)) return defaultDirectory()
    if (error instanceof CodeWikiError) throw error
    throw new CodeWikiError('CONFIG_IO', `Cannot read cache configuration: ${file}`, {
      cause: error,
    })
  }
}

export async function setCacheDirectory(path: string): Promise<string> {
  if (!path.trim()) throw new CodeWikiError('INVALID_INPUT', 'Cache directory path is empty')

  const directory = resolve(path)
  const file = configFile()
  const temp = `${file}.${randomUUID()}.tmp`

  try {
    await mkdir(directory, { recursive: true })
    await mkdir(dirname(file), { recursive: true })
    await writeFile(temp, JSON.stringify({ directory }), { mode: 0o600 })
    await rename(temp, file)
  } catch (error) {
    throw new CodeWikiError('CONFIG_IO', `Cannot set cache directory: ${directory}`, {
      cause: error,
    })
  }

  return directory
}

export async function saveWikiCache(
  repo: string,
  snapshot: WikiSnapshot,
  directory: string,
): Promise<void> {
  const file = cacheFile(repo, directory)
  const temp = `${file}.${randomUUID()}.tmp`

  try {
    await mkdir(directory, { recursive: true })
    await writeFile(temp, JSON.stringify({ version: cacheVersion, snapshot }), { mode: 0o600 })
    await rename(temp, file)
  } catch (error) {
    throw new CodeWikiError('CACHE_IO', `Cannot save wiki cache for ${repo}`, { cause: error })
  }
}

export async function loadWikiCache(repo: string, directory: string): Promise<WikiSnapshot | null> {
  let data: unknown
  try {
    data = JSON.parse(await readFile(cacheFile(repo, directory), 'utf8'))
  } catch (error) {
    if (isMissing(error)) return null
    if (error instanceof SyntaxError) return null
    throw new CodeWikiError('CACHE_IO', `Cannot read wiki cache for ${repo}`, { cause: error })
  }

  const result = cachedWikiSchema.safeParse(data)
  if (!result.success) return null
  if (result.data.snapshot.repo.toLowerCase() !== repo.toLowerCase()) return null

  return result.data.snapshot
}

export async function clearWikiCache(directory: string): Promise<number> {
  let names: string[]
  try {
    names = await readdir(directory)
  } catch (error) {
    if (isMissing(error)) return 0
    throw new CodeWikiError('CACHE_IO', `Cannot list cache directory: ${directory}`, {
      cause: error,
    })
  }

  let count = 0
  for (const name of names.filter((item) => cacheFileName.test(item))) {
    try {
      await unlink(join(directory, name))
      count++
    } catch (error) {
      if (isMissing(error)) continue
      throw new CodeWikiError('CACHE_IO', `Cannot remove cache file: ${name}`, { cause: error })
    }
  }

  return count
}
