/**
 * Resource-pack tools for DeepSeek Harness. Registers:
 *   mc_pack_scaffold — create a per-version resource pack project skeleton
 *   mc_pack_validate — run the all-domain rule engine (validate / analyze / log modes)
 *   mc_pack_build    — assemble source + overlays into per-version zips
 * All tools are pure local file operations (no network, no subprocess).
 * @module minecraft-pack-dev/tools
 */

import fs from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'
import { SUPPORTED_VERSIONS } from './lib/pack-format.js'
import { validatePack } from './lib/validate.js'
import { scaffoldPack } from './lib/scaffold.js'
import { buildPack } from './lib/build.js'
import { renderReport, renderBuildResult, renderScaffoldResult } from './lib/present.js'

/** Cordis plugin name. */
export const name = 'minecraft-pack-tools'
/** Service required by the tool consumer. */
export const inject = ['tools']

/** Deployment configuration (none needed for v1; kept for future knobs). */
export const Config = Schema.object({})

const versionsParam = (description) => ({
  type: 'array',
  items: { type: 'string' },
  description: `${description} 支持: ${SUPPORTED_VERSIONS.join(', ')}`,
})

/** Register the resource-pack tools on `ctx.tools`. */
export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'mc_pack_scaffold',
    description: 'Create a per-version resource pack project skeleton: pack.config.json, a source/ tree (cit/ properties with name-channel conditions, models, lang, sounds) and overlays/<mc-version>/ directories for MC 1.7.10 through 26.x. targetDir must not exist or be empty. After scaffolding, run mc_pack_validate on the project, then mc_pack_build to produce dist/<version>/<packId>.zip per target version.',
    parameters: {
      targetDir: {
        type: 'string',
        required: true,
        description: 'Absolute path of the new pack project root; must not exist or be empty.',
      },
      packId: {
        type: 'string',
        required: true,
        description: 'Pack id in lowercase kebab-case (e.g. moonlight); used as the zip name and pack.config.json id.',
      },
      versions: {
        type: 'array',
        items: { type: 'string' },
        description: `Target Minecraft versions to create overlays for; defaults to all: ${SUPPORTED_VERSIONS.join(', ')}.`,
      },
      description: {
        type: 'string',
        description: 'Pack description written into pack.mcmeta; defaults to "<packId> resource pack".',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          projectDir: { type: 'string', required: true },
          filesCreated: { type: 'array', required: true, items: { type: 'string' } },
          versions: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderScaffoldResult(value) }],
    },
    async execute(args) {
      return scaffoldPack({
        targetDir: args.targetDir,
        packId: args.packId,
        versions: args.versions,
        description: args.description,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'mc_pack_validate',
    description: 'Validate any resource pack directory with the all-domain rule engine (MC 1.7.10 to 26.x): pack.mcmeta/pack_format, strict JSON parsing with line/column, BOM/CRLF, paths with spaces, case-insensitive duplicates, PNG integrity and suspiciously-small textures, model structure (UV 0-16 grid, parent cycles, item/block/blockstate JSON), texture/font/atlas/particle reference existence, lang format and key completeness, sounds.json -> ogg refs, CIT properties (comma-separated items, dead nbt.display.* conditions on components era, damage+unbreakable, texture refs, ipattern spelling hints), dual-channel sync groups. Modes: validate (default), analyze (full-pack statistics like citresewn analyze), log (parse a latest.log snippet into pack-relative findings).',
    parameters: {
      packDir: {
        type: 'string',
        required: true,
        description: 'Absolute path of the resource pack project (pack root or scaffolded project with source/).',
      },
      targetMc: {
        type: 'string',
        description: `Optional target Minecraft version to enable era rules (e.g. 26.2, 1.12.2); supported: ${SUPPORTED_VERSIONS.join(', ')}.`,
      },
      mode: {
        type: 'string',
        enum: ['validate', 'analyze', 'log'],
        description: 'validate (default) | analyze (statistics) | log (diagnose a latest.log snippet).',
      },
      logPath: {
        type: 'string',
        description: 'Absolute path of a latest.log file to diagnose (mode=log).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          packDir: { type: 'string', required: true },
          root: { type: 'string', required: true },
          targetMc: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          era: { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }], required: true },
          stats: { type: 'object', additionalProperties: true, required: true },
          issues: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderReport(value, _args.mode || 'validate') }],
    },
    async execute(args) {
      const logText = args.logPath
        ? fs.readFileSync(args.logPath, 'utf8')
        : null
      return validatePack({
        packDir: args.packDir,
        targetMc: args.targetMc ?? null,
        mode: args.mode || 'validate',
        logText,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'mc_pack_build',
    description: 'Assemble a scaffolded resource pack project into per-version zips: merge source/ with overlays/<version>/, inject pack.mcmeta with the era pack_format, convert lang files .json -> .lang for <=1.12.2 (with the legacy .name key suffix), normalize all text to LF and strip JSON BOMs, then write dist/<version>/<packId>.zip (deterministic order, deflate). fix=true renames case-insensitive duplicate files (low-risk, reported); failOnError=true runs mc_pack_validate first and aborts on ERROR-level issues.',
    parameters: {
      packDir: {
        type: 'string',
        required: true,
        description: 'Absolute path of the pack project (with pack.config.json and source/).',
      },
      versions: {
        type: 'array',
        items: { type: 'string' },
        description: `Target versions to build; defaults to pack.config.json versions or all: ${SUPPORTED_VERSIONS.join(', ')}.`,
      },
      outDir: {
        type: 'string',
        description: 'Output directory for dist/<version>/<packId>.zip; defaults to <packDir>/dist.',
      },
      fix: {
        type: 'boolean',
        description: 'Apply low-risk automatic fixes (rename case-duplicates); default false.',
      },
      failOnError: {
        type: 'boolean',
        description: 'Run mc_pack_validate first and abort on ERROR issues; default false.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          packDir: { type: 'string', required: true },
          outDir: { type: 'string', required: true },
          id: { type: 'string', required: true },
          built: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
          errors: { type: 'array', required: true, items: { type: 'string' } },
          warnings: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderBuildResult(value) }],
    },
    async execute(args) {
      return buildPack({
        packDir: args.packDir,
        versions: args.versions,
        outDir: args.outDir,
        fix: args.fix === true,
        failOnError: args.failOnError === true,
      })
    },
  }))
}
