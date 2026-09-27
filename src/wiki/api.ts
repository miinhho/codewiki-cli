import { z } from 'zod'
import { CodeWikiError } from './errors.js'
import type { RepositoryMatch, WikiSection, WikiSnapshot } from './model.js'

const endpoint = '/_/BoqAngularSdlcAgentsUi/data/batchexecute'
const rawSectionSchema = z
  .tuple([
    z.string(),
    z.number(),
    z.string().nullish(),
    z.unknown(),
    z.string().nullish(),
    z.string().nullish(),
  ])
  .rest(z.unknown())
const documentSchema = z
  .tuple([z.tuple([z.string(), z.string().nullish()]).rest(z.unknown()), z.array(rawSectionSchema)])
  .rest(z.unknown())
const wikiPayloadSchema = z.tuple([documentSchema]).rest(z.unknown())
const searchRowSchema = z.tuple([z.string()]).rest(z.unknown())
const searchPayloadSchema = z.tuple([z.array(searchRowSchema)]).rest(z.unknown())

export interface RpcOptions {
  fetcher?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
}

export async function searchRepositories(
  query: string,
  limit: number,
  options: RpcOptions = {},
): Promise<RepositoryMatch[]> {
  const payload = await callRpc('vyWDAf', [query, limit, query, 0], '/', options)
  const parsed = searchPayloadSchema.safeParse(payload)
  if (!parsed.success)
    throw new CodeWikiError('RPC_RESPONSE', 'Invalid vyWDAf search response', {
      cause: parsed.error,
    })

  return parsed.data[0].map((row) => ({
    repo: row[0],
    url: Array.isArray(row[3]) && typeof row[3][1] === 'string' ? row[3][1] : null,
    description: Array.isArray(row[5]) && typeof row[5][0] === 'string' ? row[5][0] : null,
  }))
}

export async function fetchWiki(repo: string, options: RpcOptions = {}): Promise<WikiSnapshot> {
  const payload = await callRpc(
    'VSX6ub',
    [`https://github.com/${repo}`],
    `/github.com/${repo}`,
    options,
  )
  const parsed = wikiPayloadSchema.safeParse(payload)
  if (!parsed.success)
    throw new CodeWikiError('RPC_RESPONSE', 'Invalid VSX6ub wiki response', {
      cause: parsed.error,
    })

  const [info, rawSections] = parsed.data[0]
  const sections: WikiSection[] = rawSections.map((raw, index) => ({
    id: String(index + 1),
    title: raw[0],
    level: raw[1],
    summary: typeof raw[2] === 'string' ? raw[2] : null,
    markdown: typeof raw[5] === 'string' ? raw[5] : typeof raw[4] === 'string' ? raw[4] : '',
    anchor: typeof raw[9] === 'string' ? raw[9] : null,
  }))

  return { repo: info[0], commit: info[1] ?? null, sections }
}

async function callRpc(
  rpcId: string,
  args: unknown,
  sourcePath: string,
  options: RpcOptions,
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? Number(process.env.CODEWIKI_REQUEST_TIMEOUT ?? 30000)
  if (!z.number().int().positive().safeParse(timeoutMs).success)
    throw new CodeWikiError(
      'INVALID_INPUT',
      'CODEWIKI_REQUEST_TIMEOUT must be positive milliseconds',
    )

  let url: URL
  try {
    url = new URL(
      endpoint,
      options.baseUrl ?? process.env.CODEWIKI_BASE_URL ?? 'https://codewiki.google',
    )
  } catch (error) {
    throw new CodeWikiError('INVALID_INPUT', 'CODEWIKI_BASE_URL is invalid', { cause: error })
  }

  url.searchParams.set('rpcids', rpcId)
  url.searchParams.set('rt', 'c')
  url.searchParams.set('source-path', sourcePath)
  const body = new URLSearchParams({
    'f.req': JSON.stringify([[[rpcId, JSON.stringify(args), null, 'generic']]]),
  })

  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    throw new CodeWikiError(
      timeout ? 'RPC_TIMEOUT' : 'RPC_NETWORK',
      timeout ? `CodeWiki RPC ${rpcId} timed out` : `CodeWiki RPC ${rpcId} failed`,
      { cause: error },
    )
  }

  if (!response.ok)
    throw new CodeWikiError('RPC_HTTP', `CodeWiki RPC ${rpcId} returned HTTP ${response.status}`)

  try {
    return extractPayload(await response.text(), rpcId)
  } catch (error) {
    if (error instanceof CodeWikiError) throw error
    throw new CodeWikiError('RPC_NETWORK', `Reading RPC ${rpcId} response failed`, { cause: error })
  }
}

function extractPayload(response: string, rpcId: string): unknown {
  const results: unknown[] = []
  const body = response.trimStart().replace(/^\)\]\}'/, '')

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('[')) continue
    try {
      collectFrames(JSON.parse(trimmed), rpcId, results)
    } catch (error) {
      if (trimmed.includes('wrb.fr'))
        throw new CodeWikiError('RPC_RESPONSE', `Invalid ${rpcId} response`, { cause: error })
    }
  }

  if (results.length === 0)
    throw new CodeWikiError('RPC_RESPONSE', `RPC ${rpcId} missing from CodeWiki response`)

  return results[0]
}

function collectFrames(node: unknown, rpcId: string, results: unknown[]): void {
  if (!Array.isArray(node)) return
  if (node[0] === 'wrb.fr' && node[1] === rpcId) {
    const value = node[2]
    results.push(typeof value === 'string' ? JSON.parse(value) : value)
  }
  for (const child of node) collectFrames(child, rpcId, results)
}
