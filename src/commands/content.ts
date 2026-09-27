import { Args, Command, Flags } from '@oclif/core'
import { getWikiContent } from '../wiki/service.js'

export default class Content extends Command {
  static description = 'Read one wiki section; fetch and cache the wiki on a miss'

  static args = {
    repo: Args.string({ required: true, description: 'owner/repo or GitHub URL' }),
    id: Args.string({ required: true, description: 'Numeric section ID from sections' }),
  }

  static flags = {
    chunks: Flags.boolean({ description: 'Return Markdown chunks for LLM use' }),
    refresh: Flags.boolean({ description: 'Fetch a fresh wiki before reading' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Content)
    this.log(
      JSON.stringify(
        await getWikiContent(args.repo, args.id, {
          view: flags.chunks ? 'chunks' : 'markdown',
          refresh: flags.refresh,
        }),
      ),
    )
  }
}
