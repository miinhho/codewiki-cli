import { Args, Command, Flags } from '@oclif/core'
import { listWiki } from '../wiki/service.js'

export default class Sections extends Command {
  static description = 'List wiki sections without markdown; fetch and cache the wiki on a miss'

  static args = { repo: Args.string({ required: true, description: 'owner/repo or GitHub URL' }) }
  static flags = { refresh: Flags.boolean({ description: 'Fetch a fresh wiki' }) }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Sections)
    this.log(JSON.stringify(await listWiki(args.repo, flags)))
  }
}
