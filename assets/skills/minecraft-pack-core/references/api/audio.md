# 音频：sounds.json 与 ogg 引用

> 核对日期：2026-08。

## 1. 结构

`assets/<namespace>/sounds.json`（默认命名空间 minecraft，1.7.10 起即存在）：

```json
{
  "custom.my_event": {
    "subtitle": "custom.subtitle.my_event",
    "sounds": [
      "custom/audio_1",
      { "name": "custom/audio_2", "volume": 0.8, "pitch": 1.0 }
    ]
  }
}
```

- 事件键：`<namespace>.<名称>`；**键是注册名，不是文件路径**。
- `sounds` 数组：字符串 = 路径简写，对象 = 带音量/音调/随机权重的条目。
- 音频文件实际位置：`assets/<ns>/sounds/<name>.ogg`（name 无扩展名；游戏自动补 .ogg）。

## 2. 常见损坏与检出（mc_pack_validate）

| 问题 | 判定 | 说明 |
|---|---|---|
| 事件缺 sounds 数组 | WARN | 事件结构不完整 |
| 引用的 ogg 不存在 | ERROR（非 minecraft ns）/ WARN（minecraft ns） | 指向包内路径写错 = 必然坏；可能指向原版 = 无法核对 |
| sounds.json 根不是事件对象 | WARN | 结构错误 |
| 文件被截断/非 ogg | 结构层不查 | ogg 容器校验不在 v1（纯文件存在性） |

## 3. 分版注意

- 1.7.10–1.12.2 的声音系统与 1.13+ 基本兼容（sounds.json 结构稳定），一般无需分版；分版差异主要来自**被引用贴图/模型的时代差异**，音频本身跨时代可用。
- 音效包（纯音频资源包）是"大部分类型"之一：结构简单，validate 的音频域规则覆盖其全部可查项。
