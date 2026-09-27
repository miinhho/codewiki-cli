import { Args, Command, Flags } from '@oclif/core'
import { searchWiki } from '../wiki/service.js'

export default class Search extends Command {
  static description = 'Search repositories indexed by CodeWiki'

  static args = { query: Args.string({ required: true }) }
  static flags = { limit: Flags.integer({ default: 10, min: 1, max: 50 }) }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search)
    this.log(JSON.stringify(await searchWiki(args.query, flags.limit)))
  }
}
