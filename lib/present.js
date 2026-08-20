/**
 * 三个工具的文本卡片渲染。
 * @module minecraft-pack-dev/lib/present
 */

const SEV_LABEL = { error: 'ERROR', warn: 'WARN', info: 'INFO' }

/** 校验报告 → 文本 */
export function renderReport(report, mode = 'validate') {
  const lines = []
  const eraTxt = report.era
    ? `${report.era.version}（pf ${report.era.format}，lang=${report.era.langFormat}，components=${report.era.components}，cit=${report.era.cit}）`
    : (report.eraError ? `解析失败: ${report.eraError}` : '未指定')
  lines.push(`mc_pack_validate — ${report.packDir}`)
  lines.push(`root: ${report.root} | targetMc: ${report.targetMc || '未指定'} | era: ${eraTxt}`)
  const s = report.stats
  lines.push(`文件 ${s.files} | 问题: ERROR ${s.issuesBySeverity.error} / WARN ${s.issuesBySeverity.warn} / INFO ${s.issuesBySeverity.info} | 结论: ${report.ok ? '通过（无 ERROR）' : '未通过'}`)

  if (mode === 'analyze') {
    lines.push('')
    lines.push('=== analyze ===')
    lines.push(`CIT 属性文件: ${s.citProperties} | 模型 JSON: ${s.modelJsons} | items/*.json: ${s.itemJsons} | blocks/*.json: ${s.blockJsons} | blockstates: ${s.blockstates}`)
    lines.push(`纹理 PNG: ${s.texturePngs} | 字体 font/*.json: ${s.fontJsons} | 语言文件: ${s.langFiles}（en_us 键 ${s.langKeys}）| 声音事件: ${s.soundEvents} | 日志匹配: ${s.logMatches}`)
    const byExt = Object.entries(s.byExt).sort((a, b) => b[1] - a[1]).slice(0, 8)
    if (byExt.length) lines.push(`扩展分布: ${byExt.map(([e, n]) => `${e}=${n}`).join(' ')}`)
  }

  const bySev = { error: [], warn: [], info: [] }
  for (const i of report.issues) bySev[i.severity].push(i)
  for (const sev of ['error', 'warn', 'info']) {
    const list = bySev[sev]
    if (list.length === 0) continue
    lines.push('')
    lines.push(`--- ${SEV_LABEL[sev]}（${list.length}）---`)
    const shown = list.slice(0, mode === 'analyze' ? 10 : 100)
    for (const i of shown) {
      lines.push(`[${SEV_LABEL[i.severity]}] ${i.domain} ${i.file || '(包根)'} (${i.rule}): ${i.message}${i.hint ? `\n        ↳ ${i.hint}` : ''}`)
    }
    if (shown.length < list.length) lines.push(`… 还有 ${list.length - shown.length} 条`)
  }
  return lines.join('\n')
}

/** 构建结果 → 文本 */
export function renderBuildResult(res) {
  const lines = []
  lines.push(`mc_pack_build — ${res.packDir} → ${res.outDir}（id: ${res.id}）`)
  for (const b of res.built) {
    lines.push(`✓ ${b.version}（pf ${b.format}）→ ${b.zipPath}（${b.fileCount} 文件）`)
    for (const w of b.warnings) lines.push(`    ⚠ ${w}`)
  }
  if (res.validateReport) {
    const v = res.validateReport
    lines.push(`failOnError 校验: ${v.ok ? '通过' : `未通过（ERROR ${v.stats.issuesBySeverity.error}）`}`)
  }
  if (res.errors.length) {
    lines.push('')
    lines.push('ERROR:')
    for (const e of res.errors) lines.push(`  ✗ ${e}`)
  }
  lines.push(res.ok ? '全部版本构建完成' : '构建未完成（见上）')
  return lines.join('\n')
}

/** 脚手架结果 → 文本 */
export function renderScaffoldResult(res) {
  const lines = []
  lines.push(`mc_pack_scaffold — ${res.projectDir}`)
  lines.push(`创建 ${res.filesCreated.length} 个文件（pack.config.json / source/ / overlays/<版本>/）`)
  lines.push(`分版目标: ${res.versions.join(', ')}`)
  lines.push('下一步: mc_pack_validate <packDir>（校验）→ mc_pack_build <packDir>（产出 dist/<版本>/*.zip）')
  return lines.join('\n')
}
