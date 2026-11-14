# 帖好 TieHao — 批量社交图片工作台

浏览器本地批量处理社交/电商图片：裁剪、文字水印、目标大小压缩、ZIP + CSV 导出。图片不上传服务器，无需注册。

## 功能

- **画布**：3:4（1080×1440）、1:1（1200×1200）、16:9（1920×1080）、9:16（1080×1920）、原图、自定义尺寸
- **填充**：contain（留白）/ cover（裁切）
- **水印**：文字、5 个位置、大小与透明度可调
- **压缩**：JPEG / WebP 按目标 KB 压缩
- **导出**：ZIP（含 manifest.csv 清单）或单图下载
- **品牌预设**：localStorage 保存，JSON 导入导出

## 版本

| 版本 | 限制 | 价格 |
|---|---|---|
| 在线体验版 | 每批 3 张 | 免费 |
| 离线批量版 | 每批 30 张，单 HTML 文件完全离线 | ¥29 一次买断 |

## 本地运行

```bash
npm install
npm run build   # 生成 public/index.html（在线版）与 product/TieHao-Offline.html（离线版）
npm run dev     # 本地预览
npm test        # Playwright 自动化测试
npm run package # 打包离线版 ZIP
```

## 技术与许可

基于 MIT 许可的 [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)（压缩）与 [JSZip](https://github.com/Stuk/jszip)（打包，MIT 选项）。第三方许可见 `product/LICENSES.txt`。

画布尺寸为常用工作画布，非平台官方强制规范。图片在浏览器本地处理。
