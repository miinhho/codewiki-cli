import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fetchWiki, searchRepositories } from '../dist/wiki/api.js'
import {
  clearWikiCache,
  getCacheDirectory,
  loadWikiCache,
  saveWikiCache,
  setCacheDirectory,
} from '../dist/wiki/cache.js'
import { sectionChunks } from '../dist/wiki/model.js'
import { CodeWikiError } from '../dist/wiki/errors.js'
import { getWikiContent, listWiki, searchWiki } from '../dist/wiki/service.js'

const markdown = [
  '# Overview',
  '',
  'Intro with **emphasis**.',
  '',
  '## API',
  '',
  '```md',
  '# Inside a code fence',
  '```',
  '',
  '| Name | Value |',
  '| --- | --- |',
  '| a | b |',
  '',
].join('\n')

const payload = [
  [
    ['fastify/demo', 'abc123'],
    [
      ['Overview', 1, 'Summary', null, 'fallback', markdown, 1, [], null, '#overview'],
      ['Details', 2, null, null, 'Legacy body', null, 2, [], null, '#details'],
    ],
  ],
  [[null, 'https://github.com/fastify/demo'], true, 4],
  'Huge aggregate markdown',
]

test('RPC adapter decodes positional arrays and sends the expected request', async () => {
  const requests = []
  const fetcher = async (url, options) => {
    const id = url.searchParams.get('rpcids')
    requests.push({ id, sourcePath: url.searchParams.get('source-path'), body: options.body })
    const result =
      id === 'VSX6ub' ? payload : [[['fastify/demo', null, null, [null, 'url'], null, ['desc']]]]
    return new Response(
      `)]}'\n123\n[["wrb.fr","other","[]"],["wrb.fr",${JSON.stringify(id)},${JSON.stringify(JSON.stringify(result))}]]`,
    )
  }
  const wiki = await fetchWiki('fastify/demo', { fetcher })
  assert.equal(wiki.repo, 'fastify/demo')
  assert.equal(wiki.commit, 'abc123')
  assert.deepEqual(wiki.sections[0], {
    id: '1',
    title: 'Overview',
    level: 1,
    summary: 'Summary',
    markdown,
    anchor: '#overview',
  })
  assert.equal(wiki.sections[1].markdown, 'Legacy body')
  assert.deepEqual(await searchRepositories('fastify', 2, { fetcher }), [
    { repo: 'fastify/demo', url: 'url', description: 'desc' },
  ])
  assert.deepEqual(
    requests.map(({ id, sourcePath }) => [id, sourcePath]),
    [
      ['VSX6ub', '/github.com/fastify/demo'],
      ['vyWDAf', '/'],
    ],
  )
  assert.match(requests[0].body.toString(), /f\.req=/)
})

test('splits GFM by headings while preserving exact Markdown', () => {
  const snapshot = {
    repo: 'fastify/demo',
    commit: 'abc123',
    sections: [{ id: '1', title: 'Overview', level: 1, summary: null, anchor: null, markdown }],
  }
  const chunks = sectionChunks(snapshot.sections[0])
  assert.deepEqual(
    chunks.map(({ id, headingPath }) => ({ id, headingPath })),
    [
      { id: '1.1', headingPath: ['Overview'] },
      { id: '1.2', headingPath: ['Overview', 'API'] },
    ],
  )
  assert.equal(chunks.map((chunk) => chunk.markdown).join(''), markdown)
  assert.match(chunks[1].markdown, /# Inside a code fence/)
  assert.match(chunks[1].markdown, /\| Name \| Value \|/)
})

test('splits long heading-free sections at paragraph boundaries', () => {
  const longMarkdown = [
    'First ' + 'a'.repeat(1200),
    'Second ' + 'b'.repeat(1200),
    'Third ' + 'c'.repeat(1200),
  ].join('\n\n')
  const snapshot = {
    repo: 'fastify/demo',
    commit: 'abc123',
    sections: [
      { id: '1', title: 'Overview', level: 1, summary: null, anchor: null, markdown: longMarkdown },
    ],
  }
  const chunks = sectionChunks(snapshot.sections[0])
  assert.equal(chunks.length, 3)
  assert.deepEqual(
    chunks.map((chunk) => chunk.headingPath),
    [['Overview'], ['Overview'], ['Overview']],
  )
  assert.equal(chunks.map((chunk) => chunk.markdown).join(''), longMarkdown)
})

test('service owns fetch, cache, search, and section projections', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'codewiki-cli-test-'))
  const calls = []
  const gateway = {
    async fetch(repo) {
      calls.push(['fetch', repo])
      return {
        repo: 'fastify/demo',
        commit: 'abc123',
        sections: [
          {
            id: '1',
            title: 'Overview',
            level: 1,
            summary: 'Summary',
            anchor: '#overview',
            markdown,
          },
          {
            id: '2',
            title: 'Details',
            level: 2,
            summary: null,
            anchor: '#details',
            markdown: 'Legacy body',
          },
        ],
      }
    },
    async search(query, limit) {
      calls.push(['search', query, limit])
      return [{ repo: 'fastify/demo', url: null, description: null }]
    },
  }
  try {
    const dependencies = { source: gateway, cacheDirectory: cacheDir }
    const sections = await listWiki('https://github.com/fastify/demo', {}, dependencies)
    assert.equal(sections.sections[0].title, 'Overview')
    assert.equal(sections.sections[0].id, '1')
    assert.equal('markdown' in sections.sections[0], false)

    const section = await getWikiContent('fastify/demo', '1', {}, dependencies)
    assert.equal(section.section.markdown, markdown)
    const chunkView = await getWikiContent('fastify/demo', '1', { view: 'chunks' }, dependencies)
    assert.equal('markdown' in chunkView.section, false)
    assert.equal(chunkView.section.chunks.length, 2)
    assert.deepEqual(calls, [['fetch', 'fastify/demo']])

    assert.deepEqual(await searchWiki(' fastify ', 2, dependencies), {
      query: 'fastify',
      items: [{ repo: 'fastify/demo', url: null, description: null }],
    })
    assert.deepEqual(calls.at(-1), ['search', 'fastify', 2])
    await assert.rejects(
      getWikiContent('fastify/demo', '99', {}, dependencies),
      /available IDs: 1, 2/,
    )
    await getWikiContent('fastify/demo', '1', { refresh: true }, dependencies)
    assert.equal(calls.filter(([kind]) => kind === 'fetch').length, 2)
    const fresh = { source: gateway, cacheDirectory: join(cacheDir, 'fresh') }
    assert.equal((await getWikiContent('fastify/demo', '1', {}, fresh)).section.markdown, markdown)
    assert.equal(calls.filter(([kind]) => kind === 'fetch').length, 3)
  } finally {
    await rm(cacheDir, { recursive: true, force: true })
  }
  await assert.rejects(
    listWiki('https://example.com/fastify/demo', {}, { source: gateway, cacheDirectory: cacheDir }),
    /github.com/,
  )
})

test('cache validates JSON, clears only owned files, and persists directory setting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codewiki-cli-cache-'))
  const priorConfig = process.env.XDG_CONFIG_HOME
  const priorOverride = process.env.CODEWIKI_CACHE_DIR
  process.env.XDG_CONFIG_HOME = join(root, 'config')
  delete process.env.CODEWIKI_CACHE_DIR
  try {
    const directory = join(root, 'wiki')
    assert.equal(await setCacheDirectory(directory), directory)
    assert.equal(await getCacheDirectory(), directory)
    await saveWikiCache(
      'fastify/demo',
      {
        repo: 'fastify/demo',
        commit: 'abc123',
        sections: [{ id: '1', title: 'Overview', level: 1, summary: null, anchor: null, markdown }],
      },
      directory,
    )
    assert.equal((await loadWikiCache('fastify/demo', directory)).sections[0].markdown, markdown)
    const { writeFile, readdir } = await import('node:fs/promises')
    await writeFile(join(directory, 'keep.json'), '{}')
    const owned = (await readdir(directory)).find((name) => /^wiki-[a-f0-9]{64}\.json$/.test(name))
    await writeFile(join(directory, owned), '{invalid')
    assert.equal(await loadWikiCache('fastify/demo', directory), null)
    assert.equal(await clearWikiCache(directory), 1)
    assert.deepEqual(await readdir(directory), ['keep.json'])
    assert.equal(await clearWikiCache(directory), 0)
  } finally {
    if (priorConfig === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = priorConfig
    if (priorOverride === undefined) delete process.env.CODEWIKI_CACHE_DIR
    else process.env.CODEWIKI_CACHE_DIR = priorOverride
    await rm(root, { recursive: true, force: true })
  }
})

test('service and RPC expose stable error codes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codewiki-cli-error-'))
  try {
    await assert.rejects(
      getWikiContent('fastify/demo', 'invalid', {}, { cacheDirectory: root }),
      (error) => {
        assert.equal(error.code, 'INVALID_INPUT')
        return true
      },
    )
    await assert.rejects(
      fetchWiki('fastify/demo', { fetcher: async () => new Response('broken') }),
      (error) => {
        assert.ok(error instanceof CodeWikiError)
        assert.equal(error.code, 'RPC_RESPONSE')
        return true
      },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
