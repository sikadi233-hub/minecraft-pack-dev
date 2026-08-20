/**
 * PNG 结构检查与最小 PNG 生成（无第三方依赖：zlib + 自写 CRC）。
 * 只做结构级检查（签名/IHDR/截断），不做像素解码——像素级统计（如
 * ArmorHB 穿戴层残缺）是 v2 目标，v1 用字节阈值启发式替代。
 * @module minecraft-pack-dev/lib/png
 */

import { deflateSync } from 'node:zlib'
import { crc32 } from './crc32.js'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])

/**
 * 检查 PNG buffer 的结构合法性。
 * @param {Buffer} buf
 * @returns {{ ok: boolean, width?: number, height?: number, error?: string }}
 */
export function checkPng(buf) {
  if (!Buffer.isBuffer(buf)) return { ok: false, error: '不是 Buffer' }
  if (buf.length < 8) return { ok: false, error: '文件过短（<8 字节），不是合法 PNG' }
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIGNATURE[i]) return { ok: false, error: 'PNG 签名错误（第 ' + (i + 1) + ' 字节）' }
  }
  if (buf.length < 8 + 25) return { ok: false, error: '文件被截断（缺少 IHDR）' }
  // IHDR: length(4) + "IHDR"(4) + width(4) + height(4) + bitDepth(1) + colorType(1)
  const chunkType = buf.toString('ascii', 12, 16)
  if (chunkType !== 'IHDR') return { ok: false, error: '第一个数据块不是 IHDR（' + chunkType + '）' }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (width === 0 || height === 0) return { ok: false, error: `非法尺寸 ${width}x${height}` }
  if (width > 32768 || height > 32768) return { ok: false, error: `尺寸异常 ${width}x${height}（>32768）` }
  // IEND 缺失提示截断（允许最后若干字节容差）
  const tail = buf.subarray(Math.max(0, buf.length - 32))
  if (buf.indexOf(IEND) < 0 && tail.indexOf(IEND) < 0) {
    return { ok: false, error: `文件可能被截断（未找到 IEND 块，${width}x${height}）` }
  }
  return { ok: true, width, height }
}

/**
 * 残缺启发式：较大尺寸（>=64）但文件很小（<1KB）→ 可能大面积透明/未画完
 * （ArmorHB 案：530 字节、202/2048 不透明像素）。v1 用尺寸+字节阈值近似。
 * @param {number} width
 * @param {number} height
 * @param {number} fileSize
 * @returns {boolean}
 */
export function suspiciousSmall(width, height, fileSize) {
  return width >= 64 && height >= 64 && fileSize < 1024
}

/**
 * 生成一个 RGBA PNG（filter 0 逐行 + deflate）。供模板生成与测试使用。
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => [number, number, number, number]} [pixel]
 * @returns {Buffer}
 */
export function makePng(width, height, pixel = () => [0, 0, 0, 0]) {
  const raw = Buffer.alloc(height * (1 + width * 4))
  let o = 0
  for (let y = 0; y < height; y++) {
    raw[o++] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y)
      raw[o++] = r & 0xFF
      raw[o++] = g & 0xFF
      raw[o++] = b & 0xFF
      raw[o++] = a & 0xFF
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const idat = deflateSync(raw)
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    const body = Buffer.concat([head, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body.subarray(4)), 0)
    return Buffer.concat([body, crc])
  }
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
