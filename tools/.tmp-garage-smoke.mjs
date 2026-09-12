// Разовый прогон вкладки гаража в живом Chrome: модалка ещё не подключена к
// MainScene (шаг 7 интегрируется отдельно), поэтому создаём её из консоли.
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://localhost:3112'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => window.__game, { timeout: 30000 })
const wait = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
await wait(2500)

// Наливаем ресурсы и немного частей, иначе половина кнопок гаснет.
await page.evaluate(() => {
  const sc = window.__game.scene.getScene('Main')
  const s = sc.state
  s.cash = 1e9
  s.addGems(5000, false)
  for (const k of ['grare', 'gepic', 'glegendary']) s.parts.addShards(k, 500)
  s.parts.addCoupon('parts', 3)
  s.drawParts('parts', 10)
  s.autoGarage()
})

await page.evaluate(async () => {
  const mod = await import('/src/ui/garage/GarageModal.js')
  const sc = window.__game.scene.getScene('Main')
  window.__gm = new mod.GarageModal(sc, sc.state, {
    onClose: () => { window.__gm = null },
    onChange: () => {},
    toast: (t, c) => sc.toasts.show(t, c),
  })
})
await wait(600)

const tap = async (x, y) => {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await wait(60)
  await page.mouse.up()
  await wait(300)
}
const boundsOf = (path) => page.evaluate((p) => {
  const obj = p.split('.').reduce((o, k) => o?.[/^\d+$/.test(k) ? Number(k) : k], window.__gm)
  if (!obj?.getBounds) return null
  const b = obj.getBounds()
  return { x: b.centerX, y: b.centerY, w: b.width, h: b.height }
}, path)
const tapPath = async (path) => {
  const b = await boundsOf(path)
  if (!b) { errors.push('нет объекта ' + path); return null }
  await tap(b.x, b.y)
  return b
}

const probe = async (label) => page.evaluate((l) => {
  const s = window.__game.scene.getScene('Main').state
  const v = window.__gm.view
  return {
    tab: l, boxH: v.boxH, children: v.list.length,
    car: s.car?.name ?? null, cash: Math.round(s.cash), gems: Math.floor(s.gems),
  }
}, label)

const out = []
out.push(await probe('cars'))
await page.screenshot({ path: '/tmp/garage-cars.png' })
// Вторая машина класса — кнопка разблокировки за гемы.
await tapPath('view.cards.1.btn')
await tapPath('view.upgrade')
out.push(await probe('cars after taps'))
await page.screenshot({ path: '/tmp/garage-cars2.png' })

await tapPath('tabs.1')
out.push(await probe('parts'))
await tapPath('view.rows.0.btn')
await tapPath('view.auto')
await tapPath('view.packs.rows.0.b1')
await tapPath('view.packs.rows.1.coupon')
out.push(await probe('parts after taps'))
await page.screenshot({ path: '/tmp/garage-parts.png' })
await page.mouse.move(195, 500)
await page.mouse.wheel({ deltaY: 900 })
await wait(500)
await page.screenshot({ path: '/tmp/garage-parts-bottom.png' })

await tapPath('tabs.2')
out.push(await probe('paint'))
await tapPath('view.paints.1.btn')
await tapPath('view.decals.2.btn')
out.push(await probe('paint after taps'))
await page.screenshot({ path: '/tmp/garage-paint.png' })
await page.mouse.move(195, 500)
await page.mouse.wheel({ deltaY: 900 })
await wait(500)
await page.screenshot({ path: '/tmp/garage-paint-bottom.png' })

console.log(JSON.stringify(out, null, 1))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
