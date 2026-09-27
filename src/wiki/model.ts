import { marked } from 'marked'
import { z } from 'zod'
import { CodeWikiError } from './errors.js'

const targetChunkLength = 2400

export const wikiSectionSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  title: z.string(),
  level: z.number().finite(),
  summary: z.string().nullable(),
  anchor: z.string().nullable(),
  markdown: z.string(),
})

export const wikiSnapshotSchema = z.object({
  repo: z.string(),
  commit: z.string().nullable(),
  sections: z.array(wikiSectionSchema),
})

export type WikiSection = z.infer<typeof wikiSectionSchema>
export type WikiSnapshot = z.infer<typeof wikiSnapshotSchema>

export interface RepositoryMatch {
  repo: string
  url: string | null
  description: string | null
}

export interface MarkdownChunk {
  id: string
  headingPath: string[]
  markdown: string
}

export function listSections(snapshot: WikiSnapshot) {
  const { repo, commit, sections } = snapshot
  return {
    repo,
    commit,
    sections: sections.map(({ id, title, level, summary, anchor }) => ({
      id,
      title,
      level,
      summary,
      anchor,
    })),
  }
}

export function findSection(snapshot: WikiSnapshot, id: string): WikiSection {
  const section = snapshot.sections.find((item) => item.id === id)
  if (!section) {
    throw new CodeWikiError(
      'SECTION_NOT_FOUND',
      `Section ${id} not found in ${snapshot.repo}; available IDs: ${snapshot.sections.map((item) => item.id).join(', ')}`,
    )
  }
  return section
}

export function sectionChunks(section: WikiSection): MarkdownChunk[] {
  const chunks: MarkdownChunk[] = []
  const headings: { depth: number; title: string }[] = []
  let markdown = ''
  let headingPath: string[] = [section.title]
  let hasBody = false

  function flush(): void {
    if (!markdown) return

    chunks.push({ id: `${section.id}.${chunks.length + 1}`, headingPath, markdown })
    markdown = ''
    hasBody = false
  }

  for (const token of marked.lexer(section.markdown, { gfm: true })) {
    if (token.type === 'heading') {
      flush()
      while (headings.length > 0 && headings.at(-1)!.depth >= token.depth) headings.pop()
      headings.push({ depth: token.depth, title: token.text })
      const path = headings.map((heading) => heading.title)
      headingPath =
        path[0].toLowerCase() === section.title.toLowerCase() ? path : [section.title, ...path]
    } else if (hasBody && markdown.length + token.raw.length > targetChunkLength) {
      flush()
    }

    markdown += token.raw
    if (token.type !== 'heading' && token.type !== 'space') hasBody = true
  }

  flush()
  return chunks
}
