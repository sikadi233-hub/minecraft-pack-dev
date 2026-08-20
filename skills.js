/**
 * Bundled resource-pack repair skills for DeepSeek Harness. One provider
 * registers every skill shipped under assets/skills; the model loads a skill
 * body on demand through the `skill` tool (or the /<name> gesture).
 * Mirrors the minecraft-dev skills provider pattern (rank: bundled 600).
 * @module minecraft-pack-dev/skills
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'minecraft-pack-dev'

/**
 * One skill per entry. `description` is the model-routing signal (when to load
 * this skill); keep it under ~500 chars and English. v0.1 ships five focused
 * skills covering the full resource-pack surface across MC 1.7.10 - 26.x.
 */
const SKILLS = [
  {
    name: 'minecraft-pack-core',
    description: 'Resource pack fundamentals across Minecraft 1.7.10 to 26.x: pack.mcmeta and the pack_format matrix (1.7.10=1 through 26.2=84), directory layout and namespaces, the overlay mechanism (1.20.2+), zip and line-ending rules, sounds.json structure, and the four-step troubleshooting method (reading latest.log for Missing model/texture/atlas errors). Use when creating, validating, packaging, or debugging the structure of any resource pack or texture pack.',
  },
  {
    name: 'minecraft-pack-models',
    description: 'Item, block, entity and armor model knowledge for resource packs across MC 1.7.10 to 26.x: 1.21.4+ items/*.json and blocks/*.json (condition / using_item / range_dispatch), legacy blockstates variants/multipart, OptiFine model CIT, player-head entity models, OptiFine CEM, armor layers (TypeArmor, armored_layer_1/2.png), the UV 0-16 grid rule (out-of-bounds breaks translucency), parent reference cycles, and Blockbench export pitfalls. Use when creating or fixing custom models in a resource pack.',
  },
  {
    name: 'minecraft-pack-textures',
    description: 'Texture, GUI, font and particle assets for resource packs across MC 1.7.10 to 26.x: PNG specs (dimensions, transparency, animation .mcmeta, mipmap), missing-texture causes, the 1.20.5+ GUI sprite split (old paths break), the bitmap font system (1.19.3+ font/*.json vs legacy unicode fonts), particles/*.json (1.20.5+), and OptiFine sky/shader structure. Use when fixing missing or broken textures, fonts, GUI or particle assets in a resource pack.',
  },
  {
    name: 'minecraft-pack-lang',
    description: 'Language and localization files for resource packs across MC 1.7.10 to 26.x: .lang format (<=1.12.2, zh_CN.lang, .name key suffix) vs .json (1.13+, zh_cn.json, UTF-8 no BOM), key completeness checking against en_us, Chinese zh_cn supplement packs (26.2 ships no zh_cn), and the server-side literal-name boundary (item_name/custom_name cannot be translated by lang files). Use when creating, extending or fixing language files or translation packs.',
  },
  {
    name: 'minecraft-pack-cit',
    description: 'OptiFine / CIT Resewn custom item display (CIT) for resource packs across MC 1.7.10 to 26.x: .properties syntax (type / items space-separated / texture.X / nbt.* / components.* / ipattern), the condition-channel era matrix (nbt.display.Name/Lore work up to 1.20.4; components.minecraft\\:custom_name and item_name on 1.20.5+; lore matching is dead on the 26.2 citresewn fork), unbreakable silently breaking damage conditions, folder-name and items-list pitfalls, dual-channel sync, plus a MoonLight casebook of real repair cases. Use when fixing or creating CIT item/armor display properties.',
  },
]

const candidates = SKILLS.map(skill => {
  // skills.js sits at the package root, so assets are a sibling directory.
  const dir = fileURLToPath(new URL(`./assets/skills/${skill.name}/`, import.meta.url))
  return {
    name: skill.name,
    description: skill.description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: dir },
    rank: BUNDLED_SKILL_RANK,
    locator: new URL(`./assets/skills/${skill.name}/SKILL.md`, import.meta.url),
  }
})

const provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([...candidates]),
  async get(candidate) {
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: candidate.provider,
      source: candidate.source,
      resourceBase: candidate.resourceBase,
      content: await readFile(candidate.locator, 'utf8'),
    }
  },
}

/** Cordis plugin name. */
export const name = 'minecraft-pack-skills'
/** Service required by the bundled provider. */
export const inject = ['skills']

/** Register the bundled resource-pack skills provider on `ctx.skills`. */
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider)
}
