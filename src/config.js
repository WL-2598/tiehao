/**
 * 店主可编辑的配置。构建时会被 edition（web / offline）覆盖部分字段。
 * 注意：不要把任何密钥写进前端代码。
 */
export const config = {
  productName: '帖好',
  productNameEn: 'TieHao',
  version: '1.0.0',
  priceCny: 29,
  currency: 'CNY',
  /** 收款页链接（如 Stripe Payment Link）。留空则显示“配置中”。 */
  checkoutUrl: '',
  supportEmail: '',
  webMaxFiles: 3,
  offlineMaxFiles: 30,
  maxFileMB: 20,
  maxTotalMB: 150,
  maxMegapixels: 40,
}
