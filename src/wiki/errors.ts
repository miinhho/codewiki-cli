export type CodeWikiErrorCode =
  | 'INVALID_INPUT'
  | 'SECTION_NOT_FOUND'
  | 'RPC_HTTP'
  | 'RPC_RESPONSE'
  | 'RPC_NETWORK'
  | 'RPC_TIMEOUT'
  | 'CACHE_IO'
  | 'CONFIG_IO'

export class CodeWikiError extends Error {
  constructor(
    readonly code: CodeWikiErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CodeWikiError'
  }
}
