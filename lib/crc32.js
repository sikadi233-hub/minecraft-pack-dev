/**
 * CRC-32 (IEEE 802.3) — 表驱动实现，供 ZIP 与 PNG 使用。
 * @module minecraft-pack-dev/lib/crc32
 */

const TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  TABLE[n] = c >>> 0
}

/**
 * 计算 buffer 的 CRC-32（无符号）。
 * @param {Buffer|Uint8Array} buf
 * @returns {number}
 */
export function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
