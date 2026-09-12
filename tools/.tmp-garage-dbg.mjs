import puppeteer from 'puppeteer-core'
const URL = process.argv[2] || 'http://127.0.0.1:3211'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.text().startsWith('DBG')) console.log(m.text()) })
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => window.__game, { timeout: 30000 })
const wait = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
await wait(2500)
await page.evaluate(async () => {
  const mod = await import('/src/ui/garage/GarageModal.js')
  const sc = window.__game.scene.getScene('Main')
  sc.state.cash = 1e9
  sc.state.addGems(5000, false)
  window.__gm = new mod.GarageModal(sc, sc.state, { onChange: () => {}, toast: () => {} })
  const t = window.__gm.tabs[2]
  for (const ev of ['pointerdown', 'pointerup', 'pointerover', 'pointerout']) {
    t.on(ev, () => console.log('DBG tab2 ' + ev))
  }
  sc.input.on('pointerdown', (p) => console.log(`DBG scene down ${p.x},${p.y}`))
  sc.input.on('pointerup', (p) => console.log(`DBG scene up ${p.x},${p.y}`))
})
await wait(500)
const tap = async (x, y) => {
  await page.mouse.move(x, y); await page.mouse.down(); await wait(60)
  await page.mouse.up(); await wait(300)
}
const tabBounds = (i) => page.evaluate((k) => {
  const b = window.__gm.tabs[k].getBounds()
  return { x: b.centerX, y: b.centerY }
}, i)
const state = () => page.evaluate(() => ({
  tab: window.__gm.tab, scrollY: window.__gm.scroll.scrollY,
  locked: window.__gm.scroll.locked,
  inputEnabled: window.__gm.tabs[2].input?.enabled,
  hit: JSON.stringify(window.__gm.tabs[2].input?.hitArea),
  scale: window.__gm.tabs[2].scale,
  gmVisible: window.__gm.visible,
}))

let b = await tabBounds(1)
await tap(b.x, b.y)
console.log('after tab1', await state())
await page.mouse.move(195, 500)
await page.mouse.wheel({ deltaY: 900 })
await wait(400)
console.log('after wheel', await state())
b = await tabBounds(2)
console.log('tab2 bounds', b)
await tap(b.x, b.y)
console.log('after tab2', await state())
console.log('errors', errs)
await browser.close()
