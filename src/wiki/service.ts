import { z } from 'zod'
import { fetchWiki, searchRepositories } from './api.js'
import { getCacheDirectory, loadWikiCache, saveWikiCache } from './cache.js'
import { CodeWikiError } from './errors.js'
import {
  findSection,
  listSections,
  sectionChunks,
  type RepositoryMatch,
  type WikiSnapshot,
} from './model.js'

const repoSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
const sectionIdSchema = z.string().regex(/^[1-9]\d*$/)
const searchLimitSchema = z.number().int().min(1).max(50)

export interface WikiSource {
  search(query: string, limit: number): Promise<RepositoryMatch[]>
  fetch(repo: string): Promise<WikiSnapshot>
}

export interface WikiServiceDependencies {
  source?: WikiSource
  cacheDirectory?: string
}

const defaultSource: WikiSource = { search: searchRepositories, fetch: fetchWiki }

export async function searchWiki(
  query: string,
  limit = 10,
  dependencies: WikiServiceDependencies = {},
) {
  const normalized = query.trim()
  if (!normalized) throw new CodeWikiError('INVALID_INPUT', 'Search query is empty')
  if (!searchLimitSchema.safeParse(limit).success)
    throw new CodeWikiError('INVALID_INPUT', 'Limit must be 1–50')

  return {
    query: normalized,
    items: await (dependencies.source ?? defaultSource).search(normalized, limit),
  }
}

export async function listWiki(
  repoInput: string,
  options: { refresh?: boolean } = {},
  dependencies: WikiServiceDependencies = {},
) {
  const repo = normalizeRepo(repoInput)

  return listSections(await loadDocument(repo, options.refresh, dependencies))
}

export async function getWikiContent(
  repoInput: string,
  id: string,
  options: { view?: 'markdown' | 'chunks'; refresh?: boolean } = {},
  dependencies: WikiServiceDependencies = {},
) {
  const repo = normalizeRepo(repoInput)
  if (!sectionIdSchema.safeParse(id).success)
    throw new CodeWikiError('INVALID_INPUT', 'Expected a numeric section ID from sections')

  const snapshot = await loadDocument(repo, options.refresh, dependencies)
  const section = findSection(snapshot, id)
  const { markdown, ...metadata } = section

  return {
    repo: snapshot.repo,
    commit: snapshot.commit,
    section:
      options.view === 'chunks'
        ? { ...metadata, chunks: sectionChunks(section) }
        : { ...metadata, markdown },
  }
}

async function loadDocument(
  repo: string,
  refresh = false,
  dependencies: WikiServiceDependencies,
): Promise<WikiSnapshot> {
  const directory = dependencies.cacheDirectory ?? (await getCacheDirectory())
  const cached = refresh ? null : await loadWikiCache(repo, directory)
  if (cached) return cached

  const snapshot = await (dependencies.source ?? defaultSource).fetch(repo)
  if (snapshot.repo.toLowerCase() !== repo.toLowerCase())
    throw new CodeWikiError('RPC_RESPONSE', `CodeWiki returned ${snapshot.repo} for ${repo}`)

  await saveWikiCache(repo, snapshot, directory)
  return snapshot
}

function normalizeRepo(input: string): string {
  const raw = input.trim()
  let path = raw
  if (/^https?:\/\//i.test(raw)) {
    let url: URL
    try {
      url = new URL(raw)
    } catch (error) {
      throw new CodeWikiError('INVALID_INPUT', 'Invalid GitHub URL', { cause: error })
    }
    if (url.hostname.toLowerCase() !== 'github.com')
      throw new CodeWikiError('INVALID_INPUT', 'Only github.com URLs are supported')
    path = url.pathname.replace(/^\/+|\/+$/g, '')
  }

  path = path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '')
  if (!repoSchema.safeParse(path).success || path.includes('..'))
    throw new CodeWikiError('INVALID_INPUT', 'Expected owner/repo or https://github.com/owner/repo')

  return path
}
