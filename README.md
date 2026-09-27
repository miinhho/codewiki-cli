# codewiki-cli

A CLI for reading Google CodeWiki repository docs as JSON. List sections first, then request only the section content you need.

## Quick start

Requires Node.js 20 or later.

```sh
pnpm install
pnpm build
node bin/run.js sections fastify/demo
node bin/run.js content fastify/demo 1
```

Once the package is installed as a command, use `codewiki` in place of `node bin/run.js`.

## Commands

| Command                                | Result                                      |
| -------------------------------------- | ------------------------------------------- |
| `codewiki search <query>`              | Repositories matching a query               |
| `codewiki sections <repo>`             | Section IDs, titles, summaries, and anchors |
| `codewiki content <repo> <section-id>` | Markdown for one section                    |
| `codewiki cache directory [path]`      | Show or set the cache directory             |
| `codewiki cache clear`                 | Remove cached wiki documents                |

`<repo>` accepts `owner/repo` or a GitHub repository URL. `sections` omits Markdown; pass one of its numeric IDs to `content`. IDs can change when a wiki is refreshed.

Use `--refresh` with `sections` or `content` to fetch a new copy. Use `content --chunks` to get Markdown split at headings and block boundaries for smaller reading contexts. Search accepts `--limit` (1–50).

## Cache

The first `sections` or `content` request fetches the full wiki and saves it as JSON. Later requests for the same repository use the cache.

The default directory is `$XDG_CACHE_HOME/codewiki-cli`, or `~/.cache/codewiki-cli` when `XDG_CACHE_HOME` is unset. `cache directory <path>` saves a directory for future runs; `CODEWIKI_CACHE_DIR` overrides that setting.

## Agent skill

The [CodeWiki CLI skill](.agents/skills/codewiki-cli/SKILL.md) includes a built CLI. Copy the skill directory to another agent workspace to use it without this source checkout or an npm package. Run `pnpm build:skill` after changing the CLI to update the bundled copy.

## Development

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

CodeWiki's RPC is undocumented and may change. The RPC request format was informed by [izzzzzi/codewiki-mcp](https://github.com/izzzzzi/codewiki-mcp).

For agent use, see the [CodeWiki CLI skill](.agents/skills/codewiki-cli/SKILL.md).
