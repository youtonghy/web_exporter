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

## Release 打包

Release 产物由 GitHub Actions 中的 `Release` workflow 手动生成，不需要单独的 `build.yml`。

触发时输入 tag，例如：

```text
v1.2.3
```

workflow 会执行：

- `node --test`
- `node scripts/package-release.js --tag v1.2.3`
- 使用 Chrome 自带的 `--pack-extension` 生成 CRX
- 创建或更新同名 GitHub Release

发布产物包括：

- `web-exporter-chrome-v1.2.3.zip`
- `web-exporter-chrome-v1.2.3.crx`
- `web-exporter-firefox-v1.2.3.zip`
- `web-exporter-firefox-v1.2.3.xpi`

仓库内 manifest 默认保留开发占位版本 `0.0.0` / `DEV0.0.0`。Release 打包时只修改 `build/` 中的临时 manifest，不会把发布版本写回源码。

## 浏览器加载方式

- Chrome → Load unpacked → 选择 `build/chrome`
- Firefox → 临时加载 → 选择 `build/firefox`

Release zip 用户需要先解压，再选择解压后的目录加载。Firefox XPI 与 Chrome CRX 是未签名开发者模式产物，长期安装能力取决于浏览器自身限制。

## 常见问题

- 如果浏览器提示缺少 `manifest.json`，请确认加载的是 `build` 子目录而不是仓库根目录。
