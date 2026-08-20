# citresewn fork（26.2）专属规则

> 核对日期：2026-08。**来源：citresewn-continuation-1.2.2-fork.13+26.2.jar 字节码反编译（javap）+ 游戏内实测**——26.2 + fork 较新，网上无现成文档，以下结论全部来自反编译与实测，可靠性高。

## 1. 引擎事实

- 引擎：CIT Resewn Continuation fork.13，适配 26.2。
- 内置命令：`/citresewn analyze`——输出包内 CIT 加载统计（v14 实测：356 armor + 168 item 属性文件全部加载成功时即通过）。
- 日志前缀 `[citresewn]`；加载错误（如 items 列表非法）会在日志与 analyze 中可见。

## 2. 机械性规则（反编译确认）

| 规则 | 后果 | 说明 |
|---|---|---|
| 文件夹名含空格 | **整个目录被忽略**（不报错，静默） | v14 "knight items" → knight_items |
| `items=` 逗号分隔 | 报 `null is not in the item registry` | 必须空格分隔（69 个文件批量修过） |
| CRLF 换行 | 兼容（fork 有归一化），但规范要求 LF | v14 108 个文件 CRLF→LF |
| 大小写命名重复文件 | 相互遮蔽，行为不确定 | 删除大写重复（6 个文件） |
| 同名文件存在于两处目录（双通道） | 以加载顺序为准，两处必须同步 | knight_items/armor/* vs armors_migrated/knight_items/armor/* |

## 3. 条件语义（反编译确认）

- **lore 匹配失效**：`nbt.display.Lore.*=` 在 26.2 永不匹配（lore 变 compound tags，路径匹配永不成功）——**结构性失效，不是概率问题**。
- **components 匹配**：`components.minecraft\:custom_name=` / `components.minecraft\:item_name=` 用 `Component.getString()` 取文本再匹配；`ipattern:*xxx*` 为正则通配（注意键内 `\:` 转义）。
- **damage 条件与 unbreakable**：`ConditionDamage` 的百分比 = 当前耐久 / 最大耐久；带 `minecraft:unbreakable` 组件的物品 `ItemStack.isDamageableItem()` 恒 false → **百分比 = 0/0，`damage=xx%` 条件永远失败**。
  - MMOItems 物品（~720 组件，含 unbreakable）全部命中此坑 → 40 个骑士属性文件的 damage 条件被删。
- **resolveAsset 纹理解析**：texture.X 相对 `assets/<ns>/textures/` 解析；引用缺失 → 该层纹理不显示（不报错）。

## 4. TypeArmor 装备层纹理映射

- `type=armor` 的 `texture.1`/`texture.2` 按装备槽位映射到玩家模型的 1/2 穿戴层（armored_layer_1/2.png 语义）。
- 四色胸甲（Red/Green/Purple/Blue Villager Knight Chestplate）32 个文件同步修改时，条件与纹理都要一致。

## 5. 验证命令清单（v14 实测流程）

```text
/citresewn analyze                # 加载统计（356 armor + 168 item）
/data get entity @p SelectedItem  # 物品真实组件（最终裁判）
/give @p player_head[custom_model_data=10000]  # 玩家头验证
```

## 6. 与 OptiFine 的差异提醒

- 26.2 上 OptiFine 的 CEM/着色器支持受限；CIT 主路径是 citresewn fork。
- 客户端**必须**装 citresewn fork 才能生效——资源包与插件都无法替代客户端模组。
