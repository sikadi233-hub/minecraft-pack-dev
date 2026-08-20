/**
 * 最小 ZIP 读写（无第三方依赖）：写入用 deflate（method 8），
 * 读取支持 deflate（8）与 store（0）。供 mc_pack_build 产出分版包与测试回读。
 *
 * 布局参照 PKWARE APPNOTE：
 *   local header  = 30B + name + extra + data
 *   central entry = 46B + name + extra + comment
 *   EOCD          = 22B（无注释）
 * @module minecraft-pack-dev/lib/zip
 */

import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { crc32 } from './crc32.js'

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

function u16(buf, off) { return buf.readUInt16LE(off) }
function u32(buf, off) { return buf.readUInt32LE(off) }

/**
 * 写入 zip：entries 为 [{ path, data }]（path 用正斜杠；目录条目无需显式给出）。
 * @param {{ path: string, data: Buffer }[]} entries
 * @returns {Buffer}
 */
export function writeZip(entries) {
  /** @type {Buffer[]} */
  const locals = []
  /** @type {Buffer[]} */
  const centrals = []
  let offset = 0
  for (const { path, data } of entries) {
    const name = Buffer.from(path, 'utf8')
    const deflated = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL, 0)
    local.writeUInt16LE(20, 4) // version needed to extract
    local.writeUInt16LE(0x0800, 6) // general purpose flag: UTF-8 names
    local.writeUInt16LE(8, 8) // compression method: deflate
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0, 12) // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28) // extra length
    locals.push(Buffer.concat([local, name, deflated]))

    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(CENTRAL, 0)
    cen.writeUInt16LE(20, 4) // version made by
    cen.writeUInt16LE(20, 6) // version needed
    cen.writeUInt16LE(0x0800, 8) // flags
    cen.writeUInt16LE(8, 10) // method
    cen.writeUInt16LE(0, 12) // time
    cen.writeUInt16LE(0, 14) // date
    cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(deflated.length, 20)
    cen.writeUInt32LE(data.length, 24)
    cen.writeUInt16LE(name.length, 28)
    cen.writeUInt16LE(0, 30) // extra length
    cen.writeUInt16LE(0, 32) // comment length
    cen.writeUInt16LE(0, 34) // disk number start
    cen.writeUInt16LE(0, 36) // internal attributes
    cen.writeUInt32LE(0, 38) // external attributes
    cen.writeUInt32LE(offset, 42) // relative offset of local header
    centrals.push(Buffer.concat([cen, name]))

    offset += 30 + name.length + deflated.length
  }

  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD, 0)
  eocd.writeUInt16LE(0, 4) // disk number
  eocd.writeUInt16LE(0, 6) // disk with central directory
  eocd.writeUInt16LE(entries.length, 8) // entries on this disk
  eocd.writeUInt16LE(entries.length, 10) // total entries
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20) // comment length
  return Buffer.concat([...locals, centralBuf, eocd])
}

/**
 * 读取 zip，返回 [{ path, data }]（deflate 与 store 均支持；UTF-8 名）。
 * @param {Buffer} buf
 * @returns {{ path: string, data: Buffer }[]}
 */
export function readZip(buf) {
  // 从尾部找 EOCD（最后 64KB 内）
  const tailStart = Math.max(0, buf.length - 65536)
  let eocdOff = -1
  for (let i = buf.length - 22; i >= tailStart; i--) {
    if (u32(buf, i) === EOCD) { eocdOff = i; break }
  }
  if (eocdOff < 0) throw new Error('zip 中没有 EOCD 记录')
  const count = u16(buf, eocdOff + 10)
  let centralOff = u32(buf, eocdOff + 16)
  /** @type {{ path: string, data: Buffer }[]} */
  const out = []
  for (let i = 0; i < count; i++) {
    if (u32(buf, centralOff) !== CENTRAL) throw new Error(`central 目录条目损坏（第 ${i} 条）`)
    const method = u16(buf, centralOff + 10)
    const compSize = u32(buf, centralOff + 20)
    const uncompSize = u32(buf, centralOff + 24)
    const nameLen = u16(buf, centralOff + 28)
    const extraLen = u16(buf, centralOff + 30)
    const commentLen = u16(buf, centralOff + 32)
    const localOff = u32(buf, centralOff + 42)
    const name = buf.toString('utf8', centralOff + 46, centralOff + 46 + nameLen)
    // 读 local header 定位数据
    if (u32(buf, localOff) !== LOCAL) throw new Error(`local header 损坏: ${name}`)
    const lNameLen = u16(buf, localOff + 26)
    const lExtraLen = u16(buf, localOff + 28)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const packed = buf.subarray(dataStart, dataStart + compSize)
    let data
    if (method === 0) data = Buffer.from(packed)
    else if (method === 8) data = inflateRawSync(packed)
    else throw new Error(`不支持的压缩方式 ${method}: ${name}`)
    if (data.length !== uncompSize) throw new Error(`解压长度不符: ${name}`)
    out.push({ path: name, data })
    centralOff += 46 + nameLen + extraLen + commentLen
  }
  return out
}
