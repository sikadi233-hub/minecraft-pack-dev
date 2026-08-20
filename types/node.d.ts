// 自包含的 Node 环境声明（tsc 6 下，目录树内无 @types/node 时的最小声明）。
// 仅用于本包 typecheck（strict: false）；运行时由 Node 本体提供。
declare module 'node:fs'
declare module 'node:fs/promises'
declare module 'node:path'
declare module 'node:url'
declare module 'node:zlib'
declare module 'node:test'
declare module 'node:assert/strict'

declare const Buffer: any
declare const process: {
  cwd(): string
  argv: string[]
  platform: string
  env: Record<string, string | undefined>
  exit(code?: number): never
}
declare const setTimeout: (fn: () => void, ms: number) => any
declare const clearTimeout: (t: any) => void
declare const console: {
  log(...args: unknown[]): void
  error(...args: unknown[]): void
}
