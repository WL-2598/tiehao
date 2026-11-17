/** 单页模板：落地页 + 出图工作台。构建时注入 CSS / CONFIG / APP / LICENSES。 */

export function renderTemplate() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>帖好 TieHao · 批量社媒出图工作台</title>
<meta name="description" content="把一批图片统一裁切、加品牌水印、压缩并打包。图片只在浏览器本地处理，不上传服务器，无需注册。" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23c8402a'/%3E%3Ctext x='16' y='23' font-size='19' text-anchor='middle' fill='white' font-family='serif' font-weight='700'%3E%E5%B8%96%3C/text%3E%3C/svg%3E" />
<style>
{{CSS}}
</style>
</head>
<body>
<header class="site-header">
  <a class="brand" href="#top" aria-label="帖好首页">
    <span class="brand-seal">帖</span>
    <span>帖好<small>TIEHAO</small></span>
  </a>
  <nav class="site-nav" aria-label="主导航">
    <a href="#features">功能</a>
    <a href="#how">用法</a>
    <a href="#tool">工作台</a>
    <a href="#pricing">价格</a>
    <a href="#faq">常见问题</a>
  </nav>
  <button class="btn btn-primary btn-sm" type="button" data-buy>获取离线版</button>
</header>

<main id="top">
  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">一次上传，全平台铺开</p>
        <h1>一张原图，<br /><em>导出全平台要的所有尺寸。</em></h1>
        <p class="lede">勾选小红书、抖音、淘宝、Instagram……一次处理好文案、Logo、水印与体积，直接拿到 <b>24 个平台</b>的成品。图片只在你的浏览器里处理，不上传、不注册。</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#tool">免费试用<span data-max-files>3</span>张</a>
          <button class="btn btn-ghost" type="button" data-buy>离线批量版 ¥<span data-price>29</span></button>
        </div>
        <ul class="trust" aria-label="产品特性">
          <li><span data-icon="shield"></span>本地处理不上传</li>
          <li><span data-icon="zap"></span>无需注册</li>
          <li><span data-icon="lock"></span>不加平台水印</li>
          <li><span data-icon="package"></span>MIT 开源组件</li>
        </ul>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="mock-window">
          <div class="mock-bar"><span></span><span></span><span></span><b>tiehao · batch</b></div>
          <div class="mock-body">
            <div class="mock-img">
              <img id="heroMockImg" alt="" />
              <span class="mock-wm">@你的品牌</span>
            </div>
            <div class="mock-meta">
              <div class="mock-line w70"></div>
              <div class="mock-line w45"></div>
              <div class="mock-tags"><span>3:4 · 1080×1440</span><span class="pine">WebP</span><span>@你的品牌</span></div>
            </div>
          </div>
        </div>
        <div class="float-chip a"><span data-icon="check"></span><span>已处理<small>省 62% 体积</small></span></div>
        <div class="float-chip b"><span data-icon="archive"></span><span>ZIP 已生成<small>含 manifest.csv</small></span></div>
      </div>
    </div>
  </section>

  <section class="stats-band">
    <div class="wrap stats-grid">
      <div class="stat"><b><span data-count="100" data-suffix="%">0%</span></b><span>图片在本地处理</span></div>
      <div class="stat"><b><span data-count="0">0</span></b><span>数据上传到服务器</span></div>
      <div class="stat"><b><span data-count="24">0</span> 个</b><span>平台 / 交付规格</span></div>
      <div class="stat"><b>¥<span data-count="29">0</span></b><span>一次买断 · 不订阅</span></div>
    </div>
  </section>

  <section class="section" id="features">
    <div class="wrap">
      <div class="section-head center reveal">
        <p class="section-eyebrow">功能</p>
        <h2>批量出图需要的，都在这里</h2>
        <p>从裁切构图到体积压缩，全部在浏览器里完成。没有套路，没有水印，没有账号。</p>
      </div>
      <div class="feature-grid">
        <article class="feature-card reveal" style="--d:.02s">
          <div class="feature-icon"><span data-icon="grid"></span></div>
          <h3>一图多版，一次导出</h3>
          <p>勾选多个平台目标，同一张原图按 24 种规格分别输出。不用再为每个平台手动改一遍尺寸——这是最费时间的那一步。</p>
        </article>
        <article class="feature-card reveal pine" style="--d:.06s">
          <div class="feature-icon pine"><span data-icon="type"></span></div>
          <h3>文案直接排进图里</h3>
          <p>标题、卖点、角标、价签、页脚，6 种版式自动排版并处理文字遮挡与对比度。不用再开设计软件拼图。</p>
        </article>
        <article class="feature-card reveal" style="--d:.1s">
          <div class="feature-icon gold"><span data-icon="eye"></span></div>
          <h3>安全区预览</h3>
          <p>每个平台都会用 UI 压住画面边缘（抖音右侧、微博底部…）。按目标平台画出安全区，主体不会被裁掉。</p>
        </article>
        <article class="feature-card reveal" style="--d:.14s">
          <div class="feature-icon"><span data-icon="layers"></span></div>
          <h3>品牌标识与白边裁剪</h3>
          <p>上传一次 Logo，批量贴到每张图的指定角落；商品图的白底留白自动裁掉，构图立刻紧凑。</p>
        </article>
        <article class="feature-card reveal pine" style="--d:.18s">
          <div class="feature-icon pine"><span data-icon="gauge"></span></div>
          <h3>目标体积 + 焦点裁切</h3>
          <p>按目标 KB 收敛 JPEG / WebP；铺满裁切时可拖动焦点，决定保留构图里的哪一块。</p>
        </article>
        <article class="feature-card reveal" style="--d:.22s">
          <div class="feature-icon gold"><span data-icon="archive"></span></div>
          <h3>按平台分目录打包</h3>
          <p>ZIP 内按平台建目录，附 manifest.csv（原文件→输出文件、画布、体积变化），交付与归档都能直接对账。</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="how">
    <div class="wrap">
      <div class="section-head center reveal">
        <p class="section-eyebrow">用法</p>
        <h2>三步，从原图到成品</h2>
      </div>
      <div class="steps steps-4">
        <article class="step reveal">
          <span class="step-num">壹</span>
          <h3>拖入原图</h3>
          <p>拖拽或粘贴，一次可以放一整批。JPEG、PNG、WebP 都支持，单张 ≤ <b data-max-file-mb>20</b>MB。</p>
          <span class="step-arrow"><span data-icon="arrow"></span></span>
        </article>
        <article class="step reveal" style="--d:.06s">
          <span class="step-num">贰</span>
          <h3>勾选要投放的平台</h3>
          <p>小红书 3:4、抖音 9:16、淘宝主图、Instagram……一个原图可以同时勾多个目标，每个目标一套规格。</p>
          <span class="step-arrow"><span data-icon="arrow"></span></span>
        </article>
        <article class="step reveal" style="--d:.12s">
          <span class="step-num">叁</span>
          <h3>一次设好排版与品牌</h3>
          <p>文案版式、Logo 位置、白边裁剪、焦点与安全区——设置一次，整批图都按同一套规则出。</p>
          <span class="step-arrow"><span data-icon="arrow"></span></span>
        </article>
        <article class="step reveal" style="--d:.18s">
          <span class="step-num">肆</span>
          <h3>拿到分好目录的 ZIP</h3>
          <p>ZIP 按平台分目录，附 manifest.csv 对账。文件名自动带平台与尺寸，拖进后台就能发。</p>
        </article>
      </div>
    </div>
  </section>

  <section class="tool-section" id="tool">
    <div class="wrap">
      <div class="tool-head reveal">
        <p class="section-eyebrow">工作台</p>
        <h2>出图工作台</h2>
        <p class="tool-sub">支持 JPEG / PNG / WebP · 单张 ≤ <b data-max-file-mb>20</b>MB · 当前版本：<b data-edition-label>在线体验版</b>，每批最多 <b data-max-files>3</b> 张。</p>
      </div>

      <div class="limit-banner" id="limitBanner" hidden>
        <span data-icon="alert"></span>
        <span id="limitText"></span>
        <button class="btn btn-sm btn-ghost" type="button" data-buy style="margin-left:auto;flex:0 0 auto;">了解离线版</button>
      </div>

      <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="拖放、点击或粘贴图片">
        <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp" multiple hidden />
        <div class="dropzone-icon"><span data-icon="upload"></span></div>
        <p><span class="strong">拖图片到这里</span>，或点击选择，也可以直接粘贴截图</p>
        <div class="drop-actions">
          <button class="btn btn-primary btn-sm" id="pickBtn" type="button">选择图片</button>
          <button class="btn btn-ghost btn-sm" id="loadSamples" type="button">加载示例图</button>
          <button class="btn btn-ghost btn-sm" id="clearSamples" type="button">清空</button>
        </div>
        <p class="drop-stats" id="dropStats"></p>
      </div>

      <div class="workbench">
        <aside class="panel settings" aria-label="输出设置">
          <details class="set-group" open>
            <summary><span class="set-num">1</span>目标平台 · 一图多版<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <p class="hint">勾选要投放的平台，一次导出多套规格。取消全选则使用下方自定义画布。</p>
              <div class="target-toolbar">
                <input type="search" id="targetSearch" placeholder="搜索平台 / 规格" aria-label="搜索平台" />
                <button class="btn btn-ghost btn-sm" id="targetClear" type="button">清空</button>
              </div>
              <div class="target-list" id="targetList" role="group" aria-label="目标平台"></div>
              <div class="target-summary" id="targetSummary">未选择目标</div>
              <label class="field">文件名模板
                <input type="text" id="nameTemplate" value="{name}-{platform}-{w}x{h}" maxlength="60" />
                <span class="hint">可用：{name} {platform} {w} {h} {index} {ext}</span>
              </label>
            </div>
          </details>

          <details class="set-group" open>
            <summary><span class="set-num">2</span>画布与填充<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <label class="field">常用画布
                <select id="preset">
                  <option value="portrait34">竖版图文 3:4 · 1080×1440</option>
                  <option value="square11">方形商品 1:1 · 1200×1200</option>
                  <option value="landscape169">横版封面 16:9 · 1920×1080</option>
                  <option value="vertical916">竖版视频 9:16 · 1080×1920</option>
                  <option value="original">保持原尺寸</option>
                  <option value="custom">自定义尺寸</option>
                </select>
                <span class="hint" id="presetHint"></span>
              </label>
              <div class="field-row">
                <label class="field">宽 px<input type="number" id="customW" min="16" max="6000" value="1080" disabled /></label>
                <label class="field">高 px<input type="number" id="customH" min="16" max="6000" value="1440" disabled /></label>
              </div>
              <div class="field">
                <span class="field-label">适配方式</span>
                <div class="seg" role="group" aria-label="适配方式">
                  <button class="seg-btn active" type="button" data-fit="contain">完整保留 · 留白</button>
                  <button class="seg-btn" type="button" data-fit="cover">铺满裁切 · 居中</button>
                </div>
              </div>
              <label class="field">留白底色
                <input type="color" id="bgColor" value="#f6f1e8" />
                <span class="hint">仅“留白”模式生效</span>
              </label>
              <div class="field" id="focusField">
                <span class="field-label">裁切焦点</span>
                <div class="focus-pad" id="focusPad" role="application" aria-label="拖拽调整裁切焦点">
                  <span class="focus-dot" id="focusDot"></span>
                  <span class="focus-hint">拖动圆点，决定铺满时保留哪一块</span>
                </div>
                <button class="reset-link" id="focusReset" type="button">回到居中</button>
              </div>
            </div>
          </details>

          <details class="set-group" open>
            <summary><span class="set-num">3</span>品牌水印<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <label class="check"><input type="checkbox" id="wmEnable" checked /> 添加文字水印</label>
              <div id="wmFields">
                <label class="field">水印文字
                  <input type="text" id="wmText" value="@你的品牌" maxlength="40" placeholder="@你的品牌 / 店名 / 微信号" />
                </label>
                <div class="field-row">
                  <label class="field">字体
                    <select id="wmFont">
                      <option value="sans">黑体</option>
                      <option value="serif">宋体</option>
                      <option value="light">细黑</option>
                    </select>
                  </label>
                  <label class="field">颜色
                    <input type="color" id="wmColor" value="#ffffff" />
                  </label>
                </div>
                <div class="field-row" style="align-items:end;">
                  <div class="field">
                    <span class="field-label" id="wmPosLabel">位置</span>
                    <div class="pos-wrap">
                      <div class="pos-grid" id="wmPosGrid" role="group" aria-label="水印位置">
                        <button type="button" data-pos="tl" aria-label="左上"></button>
                        <button type="button" disabled aria-label="上中（不可用）"></button>
                        <button type="button" data-pos="tr" aria-label="右上"></button>
                        <button type="button" disabled aria-label="左中（不可用）"></button>
                        <button type="button" data-pos="center" aria-label="居中"></button>
                        <button type="button" disabled aria-label="右中（不可用）"></button>
                        <button type="button" data-pos="bl" aria-label="左下"></button>
                        <button type="button" disabled aria-label="下中（不可用）"></button>
                        <button type="button" data-pos="br" class="active" aria-label="右下"></button>
                      </div>
                    </div>
                  </div>
                  <div class="field">
                    <span class="field-label">选项</span>
                    <div class="check-row">
                      <label class="check"><input type="checkbox" id="wmBold" checked /> 加粗</label>
                      <label class="check"><input type="checkbox" id="wmStroke" checked /> 描边</label>
                      <label class="check"><input type="checkbox" id="wmTiled" /> 平铺</label>
                    </div>
                  </div>
                </div>
                <label class="field">大小 <output class="range-val" id="wmSizeOut">4%</output>
                  <input type="range" id="wmSize" min="1.5" max="12" step="0.5" value="4" />
                </label>
                <label class="field">透明度 <output class="range-val" id="wmOpacityOut">75%</output>
                  <input type="range" id="wmOpacity" min="0.05" max="1" step="0.05" value="0.75" />
                </label>
              </div>
            </div>
          </details>

          <details class="set-group">
            <summary><span class="set-num">3b</span>文案排版 · 一体出图<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <p class="hint">输入文案，直接把标题 / 卖点 / 价签排进图里，不用再开设计软件。</p>
              <label class="check"><input type="checkbox" id="copyEnable" /> 启用文案层</label>
              <div id="copyFields" class="is-disabled">
                <label class="field">排版
                  <select id="copyLayout"></select>
                  <span class="hint" id="copyLayoutHint"></span>
                </label>
                <label class="field">配色
                  <select id="copyTone"></select>
                </label>
                <div class="field-row" id="copyCustomColors" hidden>
                  <label class="field">底色<input type="color" id="copyBg" value="#1b1812" /></label>
                  <label class="field">文字<input type="color" id="copyFg" value="#fffdf8" /></label>
                  <label class="field">强调<input type="color" id="copyAccent" value="#e06a4e" /></label>
                </div>
                <label class="field">主标题
                  <textarea id="copyTitle" rows="2" maxlength="60" placeholder="一句话说清你在卖什么"></textarea>
                </label>
                <label class="field">副标题
                  <input type="text" id="copySubtitle" maxlength="80" placeholder="补充说明，可留空" />
                </label>
                <label class="field">卖点（逗号或换行分隔）
                  <textarea id="copyPoints" rows="2" maxlength="160" placeholder="顺丰包邮，现货当天发"></textarea>
                </label>
                <div class="field-row">
                  <label class="field">角标<input type="text" id="copyBadge" maxlength="12" placeholder="新品" /></label>
                  <label class="field">价格<input type="text" id="copyPrice" maxlength="16" placeholder="¥99" /></label>
                </div>
                <div class="field-row">
                  <label class="field">价格说明<input type="text" id="copyPriceNote" maxlength="24" placeholder="起 / 限今日" /></label>
                  <label class="field">页脚<input type="text" id="copyFooter" maxlength="40" placeholder="@你的品牌" /></label>
                </div>
                <div class="field">
                  <span class="field-label">对齐</span>
                  <div class="seg" role="group" aria-label="文字对齐">
                    <button class="seg-btn active" type="button" data-align="left">左</button>
                    <button class="seg-btn" type="button" data-align="center">中</button>
                    <button class="seg-btn" type="button" data-align="right">右</button>
                  </div>
                </div>
                <label class="field">字号 <output class="range-val" id="copyScaleOut">100%</output>
                  <input type="range" id="copyScale" min="0.6" max="1.6" step="0.05" value="1" />
                </label>
                <label class="field">遮挡强度 <output class="range-val" id="copyScrimOut">55%</output>
                  <input type="range" id="copyScrim" min="0" max="0.92" step="0.02" value="0.55" />
                </label>
              </div>
            </div>
          </details>

          <details class="set-group">
            <summary><span class="set-num">3c</span>品牌标识 / Logo<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <label class="check"><input type="checkbox" id="logoEnable" /> 添加品牌标识</label>
              <div id="logoFields" class="is-disabled">
                <div class="seg" role="group" aria-label="标识类型">
                  <button class="seg-btn active" type="button" data-logo-mode="text">文字标识</button>
                  <button class="seg-btn" type="button" data-logo-mode="image">上传 Logo</button>
                </div>
                <label class="field" id="logoTextField">标识文字
                  <input type="text" id="logoText" maxlength="24" placeholder="@你的品牌" />
                </label>
                <div class="field" id="logoImageField" hidden>
                  <button class="btn btn-ghost btn-sm" id="logoPick" type="button">选择 PNG / WebP</button>
                  <input type="file" id="logoInput" accept="image/png,image/webp,image/jpeg" hidden />
                  <p class="hint" id="logoImageHint">建议使用透明背景 PNG，宽度 ≥ 400px。</p>
                </div>
                <div class="field">
                  <span class="field-label">位置</span>
                  <div class="seg" role="group" aria-label="标识位置">
                    <button class="seg-btn active" type="button" data-logo-pos="tl">左上</button>
                    <button class="seg-btn" type="button" data-logo-pos="tr">右上</button>
                    <button class="seg-btn" type="button" data-logo-pos="bl">左下</button>
                    <button class="seg-btn" type="button" data-logo-pos="br">右下</button>
                  </div>
                </div>
                <label class="field">大小 <output class="range-val" id="logoSizeOut">4%</output>
                  <input type="range" id="logoSize" min="1.5" max="22" step="0.5" value="4" />
                </label>
                <label class="field">不透明度 <output class="range-val" id="logoOpacityOut">90%</output>
                  <input type="range" id="logoOpacity" min="0.1" max="1" step="0.05" value="0.9" />
                </label>
                <label class="check"><input type="checkbox" id="logoPlate" checked /> 加白色背板（深色图上更清晰）</label>
              </div>
            </div>
          </details>

          <details class="set-group">
            <summary><span class="set-num">3d</span>白边裁剪<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <label class="check"><input type="checkbox" id="trimEnable" /> 自动裁掉白边</label>
              <div id="trimFields" class="is-disabled">
                <label class="field">识别底色
                  <input type="color" id="trimBg" value="#ffffff" />
                  <span class="hint">商品图常见白底；浅灰底就用吸管取一下背景色</span>
                </label>
                <label class="field">容差 <output class="range-val" id="trimToleranceOut">14</output>
                  <input type="range" id="trimTolerance" min="0" max="80" step="2" value="14" />
                </label>
              </div>
            </div>
          </details>

          <details class="set-group" open>
            <summary><span class="set-num">4</span>格式与压缩<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <label class="field">输出格式
                <select id="format">
                  <option value="image/jpeg">JPEG · 兼容最好</option>
                  <option value="image/webp">WebP · 体积最小</option>
                  <option value="image/png">PNG · 无损透明</option>
                </select>
                <span class="hint" id="formatHint"></span>
              </label>
              <div id="qualityRow">
                <label class="field">质量 <output class="range-val" id="qualityOut">0.85</output>
                  <input type="range" id="quality" min="0.3" max="1" step="0.05" value="0.85" />
                </label>
              </div>
              <div id="targetRow">
                <label class="field">目标大小 KB（0 = 不限）
                  <input type="number" id="targetKB" min="0" max="20000" value="500" />
                  <span class="hint" id="targetHint"></span>
                </label>
              </div>
            </div>
          </details>

          <details class="set-group" open>
            <summary><span class="set-num">5</span>品牌预设<span class="set-chevron"><span data-icon="chevron"></span></span></summary>
            <div class="set-body">
              <div class="preset-row">
                <select id="brandSelect" aria-label="品牌预设"><option value="">选择预设…</option></select>
                <button class="btn btn-ghost btn-sm" id="brandLoad" type="button">载入</button>
                <button class="btn btn-ghost btn-sm" id="brandDelete" type="button">删除</button>
              </div>
              <div class="preset-row">
                <input type="text" id="brandName" placeholder="预设名，如：小红书主号" maxlength="24" />
                <button class="btn btn-ghost btn-sm" id="brandSave" type="button">保存当前</button>
              </div>
              <div class="preset-row">
                <button class="btn btn-ghost btn-sm" id="brandExport" type="button">导出 JSON</button>
                <button class="btn btn-ghost btn-sm" id="brandImportBtn" type="button">导入 JSON</button>
                <input type="file" id="brandImport" accept="application/json,.json" hidden />
              </div>
              <p class="hint">预设只存在这台设备的浏览器里，可导出备份。</p>
            </div>
          </details>

          <div class="set-actions">
            <button class="btn btn-primary btn-block" id="processBtn" type="button" disabled>
              <span data-icon="zap"></span> 开始处理
            </button>
            <div class="progress" aria-hidden="true"><div id="progressBar"></div></div>
            <p class="status" id="statusText" role="status" aria-live="polite">等待图片…</p>
            <button class="reset-link" id="resetSettings" type="button">恢复默认设置</button>
          </div>
        </aside>

        <section class="panel preview-panel" aria-label="预览">
          <div class="stage-head">
            <span class="stage-name" id="stageName">—</span>
            <div class="preview-tabs" role="tablist" aria-label="预览模式">
              <button class="preview-tab" type="button" data-mode="before" role="tab">原图</button>
              <button class="preview-tab active" type="button" data-mode="after" role="tab">效果</button>
              <button class="preview-tab" type="button" data-mode="compare" role="tab">对比</button>
              <button class="preview-tab" type="button" data-mode="grid" role="tab">全部产出</button>
            </div>
            <span class="stage-dims" id="stageDims"></span>
          </div>

          <div class="stage-tools">
            <label class="check check-inline"><input type="checkbox" id="safeGuide" /> 安全区参考线</label>
            <span class="stage-safe-hint" id="safeHint"></span>
          </div>

          <div class="stage-wrap">
            <div class="stage" id="stage" data-mode="after">
              <div class="stage-empty" id="stageEmpty">选择或拖入图片后在这里预览</div>
              <img class="before-img" id="imgBefore" alt="原图预览" />
              <div class="after-wrap" id="imgAfterWrap">
                <img id="imgAfter" alt="效果预览" />
              </div>
              <span class="stage-tag before">原图</span>
              <span class="stage-tag after" id="stageTagAfter">效果</span>
              <div class="compare-handle" id="compareHandle"></div>
              <input class="visually-hidden" type="range" id="compareRange" min="0" max="100" value="50" aria-label="对比滑块" />
            </div>
            <div class="stage-grid" id="stageGrid" hidden></div>
          </div>

          <dl class="meta">
            <div><dt>文件</dt><dd id="metaName">—</dd></div>
            <div><dt>原始</dt><dd id="metaBefore">—</dd></div>
            <div><dt>输出</dt><dd id="metaAfter">—</dd></div>
            <div><dt>体积变化</dt><dd id="metaDelta">—</dd></div>
            <div><dt>输出文件名</dt><dd id="metaFile">—</dd></div>
          </dl>
          <div class="preview-actions">
            <button class="btn btn-primary" id="downloadCurrent" type="button" disabled><span data-icon="download"></span> 下载当前</button>
            <button class="btn btn-pine" id="downloadZip" type="button" disabled><span data-icon="archive"></span> 下载全部 ZIP</button>
            <button class="btn btn-ghost" id="downloadCsv" type="button" disabled><span data-icon="file"></span> 清单 CSV</button>
            <button class="btn btn-ghost" id="retryFailed" type="button" disabled><span data-icon="refresh"></span> 重试失败</button>
          </div>
          <p class="summary" id="summaryText"></p>
        </section>

        <aside class="panel queue-panel" aria-label="文件队列">
          <div class="panel-head">
            <h3>队列 <span id="queueCount">0</span></h3>
            <span class="badge" id="outputBadge">单目标</span>
            <span class="badge" id="editionBadge">体验版</span>
          </div>
          <ul id="fileList" class="file-list"></ul>
          <div class="queue-empty" id="queueEmpty">还没有图片<br />拖几张进来试试</div>
          <div class="queue-foot">
            <span>原始 <b id="queueTotalBefore">—</b></span>
            <span>输出 <b id="queueTotalAfter">—</b></span>
            <button class="reset-link" id="clearQueue" type="button">清空</button>
          </div>
        </aside>
      </div>
    </div>
  </section>

  <section class="section" id="pricing">
    <div class="wrap">
      <div class="section-head center reveal">
        <p class="section-eyebrow">价格</p>
        <h2>免费版能干活，付费版省时间</h2>
        <p>在线版可以完整跑通「裁切 → 水印 → 压缩 → ZIP」。<br />离线版卖的不是解锁功能，是<b>一次交付多个平台的那 20 分钟</b>。</p>
      </div>

      <div class="roi-band reveal">
        <div class="roi-item">
          <b id="roiMinutes">—</b>
          <span>每批 3 个平台 · 手工改尺寸耗时</span>
        </div>
        <div class="roi-item">
          <b id="roiSaved">—</b>
          <span>用一图多版后节省的时间</span>
        </div>
        <div class="roi-item">
          <b>¥<span data-price>29</span></b>
          <span>一次买断，不订阅</span>
        </div>
      </div>

      <div class="price-grid">
        <article class="price-card reveal">
          <h3>在线体验</h3>
          <p class="price">¥0</p>
          <ul>
            <li>每批 <span data-max-files>3</span> 张</li>
            <li>3 个常用平台（小红书 / 抖音 / 淘宝）</li>
            <li>裁切 / 水印 / 目标体积压缩</li>
            <li>ZIP + CSV 清单</li>
            <li>无需注册，打开就用</li>
          </ul>
          <a class="btn btn-ghost btn-block" href="#tool">立即试用</a>
          <p class="fine">适合先确认出图质量是否合你的标准。</p>
        </article>
        <article class="price-card featured reveal" style="--d:.08s">
          <div class="ribbon">一次买断</div>
          <h3>离线批量版</h3>
          <p class="price">¥<span data-price>29</span> <small>永久使用</small></p>
          <ul>
            <li><b>一图多版</b>：24 个平台 / 交付规格，一次导出</li>
            <li><b>文案排版</b>：6 种版式，标题 / 卖点 / 价签直接进图</li>
            <li><b>品牌 Logo</b>：上传一次，批量贴到指定角落</li>
            <li><b>白边裁剪 + 焦点裁切</b></li>
            <li>按平台分目录打包 + manifest.csv</li>
            <li>每批 <span data-max-files-offline>30</span> 张，单文件断网可用</li>
          </ul>
          <button class="btn btn-primary btn-block" type="button" data-buy>购买离线版</button>
          <p class="fine">不是订阅。不含云存储、AI 抠图或视频处理。</p>
        </article>
      </div>

      <table class="compare-table reveal">
        <thead><tr><th>对比项</th><th>在线体验</th><th>离线批量版</th></tr></thead>
        <tbody>
          <tr><td>每批张数</td><td>3 张</td><td class="yes">30 张</td></tr>
          <tr><td>目标平台规格</td><td>3 个</td><td class="yes">24 个（含打印 / 网页交付）</td></tr>
          <tr><td>一次导出多套尺寸</td><td class="no">—</td><td class="yes">支持，最多 12 个目标 / 张</td></tr>
          <tr><td>文案排版（标题 / 卖点 / 价签）</td><td class="no">—</td><td class="yes">6 种版式</td></tr>
          <tr><td>品牌 Logo</td><td class="no">—</td><td class="yes">文字 / 上传图片</td></tr>
          <tr><td>白边裁剪 · 焦点裁切</td><td class="no">—</td><td class="yes">支持</td></tr>
          <tr><td>安全区参考线</td><td class="no">—</td><td class="yes">按平台计算</td></tr>
          <tr><td>裁切 / 水印 / 目标 KB / ZIP</td><td class="yes">支持</td><td class="yes">支持</td></tr>
          <tr><td>断网使用 · 单文件携带</td><td class="no">不支持</td><td class="yes">支持</td></tr>
          <tr><td>价格</td><td>免费</td><td class="yes">¥<span data-price>29</span> 一次买断</td></tr>
        </tbody>
      </table>

      <div class="value-notes reveal">
        <div>
          <h4>为什么这件事值得付钱</h4>
          <p>一张原图要发 3 个平台，手工流程是：裁 3 次 → 调 3 次水印 → 压 3 次体积 → 分别改名。按每次 2 分钟算，一批 9 张图就是半小时以上。</p>
          <p>一图多版把这一步变成一次勾选。买断价 ¥29，等于用不到一杯咖啡的钱，换掉每周重复的机械操作。</p>
        </div>
        <div>
          <h4>为什么不做订阅</h4>
          <p>这是本地运行的桌面级小工具，没有服务器成本，也不该按月收费。买断之后你拿到的是一个 HTML 文件，存在自己电脑里，服务停止也不影响使用。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="faq">
    <div class="wrap">
      <div class="section-head center reveal">
        <p class="section-eyebrow">常见问题</p>
        <h2>你可能想问</h2>
      </div>
      <div class="faq-list">
        <details class="reveal" open>
          <summary>在线版和离线版到底差在哪？</summary>
          <p>在线版能完整跑通裁切、水印、目标体积压缩和 ZIP 导出，只是每批 3 张、只有 3 个常用平台。<b>离线版的核心不是「解锁」，而是「一图多版」</b>：一张原图一次导出 24 种平台规格，再加上文案排版、品牌 Logo、白边裁剪和焦点裁切。这些能力解决的是同一件事——别再为每个平台手工改一遍尺寸。</p>
        </details>
        <details class="reveal">
          <summary>图片会上传吗？</summary>
          <p>不会。裁切、水印、压缩、排版和打包全部在你的浏览器里完成，页面不依赖任何外部字体、脚本或图片。断网后打开离线版同样无法回传任何数据——因为数据从来没有离开过你的设备。</p>
        </details>
        <details class="reveal">
          <summary>这些尺寸是平台官方规定吗？</summary>
          <p>不是。它们是各平台常见的工作画布与交付规格，并标注了会压住画面的 UI 区域（安全区）。平台规则可能变化，发布前请以平台最新要求为准。</p>
        </details>
        <details class="reveal">
          <summary>文案排版的字体会不会不一致？</summary>
          <p>水印与文案使用系统字体渲染。同一台电脑上批量出图完全一致；换到另一台电脑（比如把预设导给同事）字体可能略有差别。这是「完全离线、不加载在线字体」的代价。</p>
        </details>
        <details class="reveal">
          <summary>目标大小压不到怎么办？</summary>
          <p>先降压缩质量，仍超标时再按比例缩小画布。如果目标设得比原图还小很多，可能无法精确命中——此时输出该设置下最小的结果，并在队列与 manifest.csv 里标明「未达目标」，不会假装成功。</p>
        </details>
        <details class="reveal">
          <summary>白边裁剪会不会裁掉主体？</summary>
          <p>它只裁掉与「识别底色」接近的外圈像素，并且会在四周保留少量余量。识别底色可调，建议先用一张图确认容差再批量跑。</p>
        </details>
        <details class="reveal">
          <summary>离线版怎么用？</summary>
          <p>购买后下载一个 HTML 文件，双击用浏览器打开即可，无需安装、无需联网。建议 Chrome / Edge / Firefox / Safari 的较新版本。</p>
        </details>
        <details class="reveal">
          <summary>可以商用吗？</summary>
          <p>工具本身可用于商业出图。输出图片的权利取决于你输入的原图、字体与品牌素材，请确保你拥有相应权利。</p>
        </details>
        <details class="reveal">
          <summary>开源许可如何处理？</summary>
          <p>打包使用了 MIT 许可的 JSZip（页面底部与离线包内保留许可声明）。产品自身代码 MIT，与上游开源组件分开标注。</p>
        </details>
      </div>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <div class="footer-brand"><span class="brand-seal">帖</span>帖好 TieHao</div>
        <p class="footer-note">本地优先的社媒出图小工具。图片不离开你的浏览器，就像用本地软件一样安心。</p>
        <details class="licenses">
          <summary>第三方开源许可</summary>
          <pre>{{LICENSES}}</pre>
        </details>
      </div>
      <div>
        <h4>产品</h4>
        <ul class="footer-links">
          <li><a href="#tool">出图工作台</a></li>
          <li><a href="#features">功能</a></li>
          <li><a href="#pricing">价格</a></li>
          <li><a href="#faq">常见问题</a></li>
        </ul>
      </div>
      <div>
        <h4>说明</h4>
        <ul class="footer-links">
          <li><a href="#faq">隐私与本地处理</a></li>
          <li><a href="#faq">支持的格式</a></li>
          <li><a href="#pricing">离线版购买</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>帖好 TieHao v<span data-version>1.0.0</span></span>
      <span>© 2026 帖好 TieHao</span>
      <span>MIT 组件 · 本地处理</span>
    </div>
  </div>
</footer>

<div class="modal" id="buyModal" hidden role="dialog" aria-modal="true" aria-labelledby="buyTitle">
  <div class="modal-card">
    <button class="modal-close" id="buyClose" type="button" aria-label="关闭" data-close>×</button>
    <h3 id="buyTitle">获取离线批量版</h3>
    <p class="price">¥<span data-price>29</span> <small>一次买断 · 不订阅</small></p>
    <ul class="buy-points">
      <li>一图多版：24 个平台规格，一次导出</li>
      <li>文案排版 · 品牌 Logo · 白边裁剪 · 焦点裁切</li>
      <li>每批 <span data-max-files-offline>30</span> 张，单个 HTML 文件断网可用</li>
    </ul>
    <div id="buyReady" hidden>
      <p>点击下方按钮前往安全收款页，付款后下载离线 HTML 文件。若未自动跳转，请保留订单号并联系店主。</p>
      <a class="btn btn-primary btn-block" id="checkoutLink" href="#" target="_blank" rel="noopener">前往安全收款页</a>
    </div>
    <div id="buyPending">
      <p>购买通道正在配置中。你可以先免费体验核心功能；店主接入收款链接后，这里会直接跳转。</p>
      <details class="owner-config">
        <summary>店主配置说明</summary>
        <p>编辑 <code>src/config.js</code> 中的 <code>checkoutUrl</code>（如 Stripe Payment Link），运行 <code>npm run build</code> 重新生成页面。不要把密钥写进前端。</p>
      </details>
    </div>
  </div>
</div>

<div class="toast" id="toast" hidden role="status" aria-live="polite"></div>

<script>document.documentElement.className += ' js'; window.__TIEHAO_CONFIG__ = {{CONFIG}};</script>
<script>
{{APP}}
</script>
</body>
</html>
`
}
