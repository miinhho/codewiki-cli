---
name: codewiki-cli
description: Use Google CodeWiki to explore an indexed GitHub repository, study its architecture, or orient an OSS contribution with the bundled codewiki CLI.
---

# CodeWiki

Use the bundled executable at `cli/bin/run.js` relative to this `SKILL.md`; invoke it by its absolute path. It needs Node.js 20 or later, but no package installation or source checkout. The commands below use `codewiki` as shorthand for that executable.

CodeWiki RPC calls need outbound network access. Run `search`, `--refresh`, and any uncached `sections` or `content` command outside the network sandbox (in Codex, request `sandbox_permissions: "require_escalated"` for the CLI command). If access is denied, report the sandbox restriction. Do not treat an `RPC_NETWORK` or `RPC_TIMEOUT` from a sandboxed attempt as evidence that the CodeWiki service is down. Cached `sections` and `content` can run without network access.

If the repository is unknown, run `codewiki search <query>` and choose a repository from `items[].repo`. Then run `codewiki sections <owner/repo>` and use `sections[].id`, `title`, `summary`, and `anchor` to find relevant sections without loading their Markdown. Read a selected section with `codewiki content <owner/repo> <section-id>`. For a long section, use `--chunks` to inspect its `chunks[].headingPath` and `markdown`.

- For a design study or comparison with another project, read [architecture.md](references/architecture.md).
- For understanding a repository before changing or contributing code, read [contribution.md](references/contribution.md).
- For a contribution involving an architectural change, use both references.

`sections` and `content` fetch and cache the wiki automatically. When the user asks for current documentation or the cached commit is known to be stale, run `codewiki sections <owner/repo> --refresh`, then choose IDs from that new list. Section IDs are positions within a wiki snapshot and can change after a refresh.

CodeWiki is generated documentation. For code-level claims, check the repository source when available. Otherwise identify the CodeWiki repository, commit, and section that support the claim, and distinguish documented facts from inference. If the CLI returns a JSON `error`, report the code and message rather than guessing at missing content.
