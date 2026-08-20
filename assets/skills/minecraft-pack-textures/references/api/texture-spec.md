# 纹理规范：PNG、动画、残缺检测

> 核对日期：2026-08。

## 1. PNG 合法性与尺寸

- 结构：签名（89 50 4E 47 0D 0A 1A 0A）+ IHDR（宽/高/位深/颜色类型）+ IDAT + IEND。
- `mc_pack_validate` 检查：签名、IHDR 存在、尺寸非 0 且 ≤32768、IEND 存在（缺 IEND = 截断）。
- 尺寸任意正整数合法；**mipmap 完整需要 2 的幂尺寸**（1.13+ 已放宽，非强制）。
- 超大纹理（>8192）在部分显卡/旧版本上有问题（validate 对 >32768 判 ERROR，其余只看结构）。

## 2. 动画纹理

- 文件名 `<贴图>.png.mcmeta` 与贴图同目录（如 `textures/item/clock.png.mcmeta`）。
- 结构：
  ```json
  {
    "animation": {
      "frametime": 1,
      "frames": [0, 1, 2, 1]
    }
  }
  ```
- `frames` 可为数字数组（帧序号，可重复/乱序）或对象数组（`{"index": 0, "time": 2}`）；`frametime` 默认 1（= 1/20 秒）。
- validate：`animation.frames` 非数组 → WARN；`frametime` 非数字或 <1 → WARN。
- 常见坑：把贴图画成横条动画但漏了 .mcmeta（静态显示）；帧数超过贴图行数。

## 3. 缺失纹理与紫黑格

- 紫黑格 = 纹理加载失败：文件缺失、路径引用错、PNG 损坏。
- 引用来源：模型 textures 变量、CIT texture.X=/particle=、字体 bitmap file、粒子 textures[]、atlas directory。
- validate 统一检查存在性：**非 minecraft 命名空间缺失 = ERROR**（自定义内容必然坏）；**minecraft 命名空间缺失 = WARN**（可能是合法叠包指向原版/下层包）。

## 4. 残缺启发式（v14 ArmorHB 案）

- 现象：穿戴层纹理只有身体部分画了（头盔/肩/手臂全空）→ 穿戴透明。
- 数据：`armored_layer_1.png` 530 字节、202/2048 不透明像素（正常套装 ≈632 像素）。
- **v1 检测**：宽高 ≥64 且文件 <1KB → WARN `png-small`（"可能大面积透明/残缺"）。
- 像素级统计（精确不透明像素数）是 v2 目标；v1 用字节阈值近似，误报可接受（WARN 级）。
- 处理：重建纹理（v12 做过完整黑曜石版）或按用户意图恢复原版透明版（v14 终局：换回 530 字节原始文件）。
