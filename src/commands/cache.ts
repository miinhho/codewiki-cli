import { Args, Command } from '@oclif/core'
import { clearWikiCache, getCacheDirectory, setCacheDirectory } from '../wiki/cache.js'
import { CodeWikiError } from '../wiki/errors.js'

export default class Cache extends Command {
  static description = 'Inspect, configure, or clear the wiki cache'

  static args = {
    action: Args.string({ required: true, options: ['clear', 'directory'] }),
    path: Args.string({ required: false }),
  }

  async run(): Promise<void> {
    const { args } = await this.parse(Cache)
    if (args.action === 'directory') {
      if (args.path) {
        const directory = await setCacheDirectory(args.path)
        this.log(JSON.stringify({ directory, configured: true }))
      } else {
        const directory = await getCacheDirectory()
        this.log(JSON.stringify({ directory }))
      }
      return
    }

    if (args.path) throw new CodeWikiError('INVALID_INPUT', 'cache clear does not accept a path')

    const directory = await getCacheDirectory()
    this.log(JSON.stringify({ directory, removed: await clearWikiCache(directory) }))
  }
}
