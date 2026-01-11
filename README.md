# web_exporter

这是一个自制的，将浏览器网页中选定区域导出为 PDF/MarkDown/PNG 的浏览器插件。 之所以制作这个插件，是因为之前我有大量需要在网上阅读的文献，需要将这些文献下载下来，并传给 AI。但是我以前所使用的一些比较流行的工具，仅能生成非常短小的区块，否则的话就会收费，而且一年还要好几十美金。我觉得这是非常荒谬的，所以我自己做的这个插件，希望能帮助到大家。由于使用的是AI来进行开发。虽然我已经进行了大部分网页上的测试，但是可能还存在一些问题，欢迎大家提交反馈。

## 如何使用

我已经打包了适用于Chrome浏览器的CRX，并发表在release中可以直接下载并使用。如果你的Chrome浏览器不支持的话，可以请先开启开发者模式。

## 关于上架商店

我目前已经上架了 Firefox 商店，链接在下面。

https://addons.mozilla.org/zh-CN/firefox/addon/web-exporter/

Chrome 商店的话，因为注册成为开发者需要付5美元。虽然这个价格不贵，但是我不太想付，因为这个插件本身就是免费的，我也不赚钱，那我还要给谷歌花钱去，我觉得这样很不合理，所以你们可以直接在 release 里面下载 CRX 文件自己加载到自己的浏览器中就好了。

## Chrome (MV3) 与 Firefox (MV2) 同时兼容

由于 Firefox 临时附加组件加载时可能禁用 `background.service_worker`，本项目采用“分别构建两份产物”的方式：

- Chrome：Manifest V3（service worker）
- Firefox：Manifest V2（background scripts）

开发与加载都使用 `build` 目录，避免直接加载源代码目录造成歧义。

构建（Node.js，跨平台）：

- `node scripts/build.js --target all`

构建输出：

- `build/chrome/`（Chrome 加载此目录）
- `build/firefox/`（Firefox 临时加载此目录）

更详细的使用说明见 `BUILDING.md`。