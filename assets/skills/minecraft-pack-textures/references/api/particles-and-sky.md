# 粒子与天空/着色器

> 核对日期：2026-08。

## 1. 粒子系统断代

| 时代 | 系统 |
|---|---|
| ≤1.20.4 | 粒子贴图在 `textures/particle/*.png`（代码引用，包只能替换贴图） |
| 1.20.5+ | **数据驱动**：`assets/<ns>/particles/*.json` 定义粒子类型 |

## 2. particles/*.json（1.20.5+）

```json
{
  "textures": ["minecraft:particle/dust", "minecraft:particle/dust_2"]
}
```

- `textures[]`：贴图路径（可多张，随机选取）；引用 `textures/particle/*.png`。
- validate：textures 数组 → 每项存在性检查（非 minecraft ns 缺失 = ERROR）。

## 3. OptiFine 天空与着色器（文件层）

- 自定义天空：`assets/minecraft/optifine/sky/world0/sky_*.properties` + 贴图。
- 着色器：`shaders/`（GLSL，OptiFine 专属）与 Iris 的 `shaders/` 结构不同。
- **v1 范围**：只查目录/文件存在性（validate 不覆盖）；GLSL 语法、着色器兼容性不做修复。
- 26.2：原版有正式渲染管线（延迟渲染），OptiFine 着色器生态受限——确认目标客户端前端再动 shaders。

## 4. 常见坑

- 1.20.5+ 版本把粒子贴图放旧路径 → 粒子不显示（应放 textures/particle/ 且被 particles/*.json 引用）。
- 粒子 JSON 引用的贴图缺失 → 报 Missing texture 或粒子透明。
- 分版：particles/*.json 只进 1.20.5+ overlay；旧版 overlay 不需要该目录。
