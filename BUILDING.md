# 构建与加载指南

本项目使用 Node.js 脚本在 `build/` 下生成 Chrome 与 Firefox 的独立产物，避免直接加载源代码目录造成歧义。

## 前置条件

- Node.js 14+（建议 16+）

## 构建命令

在仓库根目录执行：

```bash
node scripts/build.js --target all
```

可选目标：

- `--target chrome`
- `--target firefox`
- `--target all`

## 产物结构

构建完成后将生成：

- `build/chrome/`
- `build/firefox/`

其中每个目录都包含该浏览器的 `manifest.json` 与运行所需的所有文件。

## 浏览器加载方式

- Chrome → Load unpacked → 选择 `build/chrome`
- Firefox → 临时加载 → 选择 `build/firefox`

## 常见问题

- 如果浏览器提示缺少 `manifest.json`，请确认加载的是 `build` 子目录而不是仓库根目录。
