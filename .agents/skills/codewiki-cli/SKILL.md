---
name: codewiki-cli
description: Find and read Google CodeWiki documentation for GitHub repositories with the codewiki CLI. Use when a task calls for CodeWiki or needs an indexed repository's wiki to understand its structure or behavior.
---

# CodeWiki CLI

Use the bundled executable at `cli/bin/run.js` relative to this `SKILL.md`; invoke it by its absolute path. It needs Node.js 20 or later, but no package installation or source checkout. The commands below use `codewiki` as shorthand for that executable.

1. If the repository is unknown, run `codewiki search <query>` and choose a repository from `items[].repo`. If the repository is known, go directly to `codewiki sections <owner/repo>`.
2. Read `sections[].id`, `title`, `summary`, and `anchor` to identify relevant sections. The list omits Markdown.
3. Run `codewiki content <owner/repo> <section-id>` only for sections needed by the task. For a long section, use `--chunks` and inspect its `chunks[].headingPath` and `markdown`.

`sections` and `content` fetch and cache the wiki automatically. When the user asks for current documentation or the cached commit is known to be stale, run `codewiki sections <owner/repo> --refresh`, then choose IDs from that new list. Section IDs are positions within a wiki snapshot and can change after a refresh.

CodeWiki is generated documentation. When making a code-level claim, check the repository source if available; otherwise identify the CodeWiki repository, commit, and section that support the answer. If the CLI returns a JSON `error`, report the code and message rather than guessing at missing content.
