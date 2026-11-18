import { icon } from './icons.js'

let toastTimer = 0

/** 底部提示条。page 传入文档（默认当前 document），便于单页/离线复用。 */
export function toast(message, type = 'info', ms = 2800) {
  let box = document.querySelector('.toast')
  if (!box) {
    box = document.createElement('div')
    box.className = 'toast'
    box.setAttribute('role', 'status')
    box.setAttribute('aria-live', 'polite')
    document.body.appendChild(box)
  }
  const iconName = type === 'success' ? 'check' : type === 'alert' ? 'alert' : 'sparkles'
  box.innerHTML = `<span class="toast-icon">${icon(iconName, 16)}</span><span>${message}</span>`
  box.classList.toggle('toast-alert', type === 'alert')
  box.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => box.classList.remove('show'), ms)
}

export function initModal(modal) {
  if (!modal) return { open() {}, close() {} }
  const close = () => { modal.hidden = true }
  const open = () => { modal.hidden = false }
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close()
  })
  return { open, close }
}

/** 滚动进入视口的渐显动画。 */
export function initReveal() {
  const items = document.querySelectorAll('.reveal')
  if (!items.length) return
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'))
    return
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in')
        io.unobserve(entry.target)
      }
    }
  }, { threshold: 0.12 })
  items.forEach((el) => io.observe(el))
}

/** 数字滚动（如 “100% 本地”）。 */
export function initCountUp() {
  const nums = document.querySelectorAll('[data-count]')
  if (!nums.length) return
  const run = (el) => {
    const target = Number(el.dataset.count)
    const suffix = el.dataset.suffix || ''
    const dur = 900
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      el.textContent = `${Math.round(target * eased)}${suffix}`
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  if (!('IntersectionObserver' in window)) {
    nums.forEach(run)
    return
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        run(entry.target)
        io.unobserve(entry.target)
      }
    }
  }, { threshold: 0.4 })
  nums.forEach((el) => io.observe(el))
}

export function initNavScroll() {
  const header = document.querySelector('.site-header')
  if (!header) return
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}
