// Кадр справки по ⓘ. Отдельным пробником, а не экраном в screens.mjs: окно
// открывается ТАПОМ по карточке, то есть заодно проверяет входной слой, а
// SCREENS доводит игру до экрана вызовами методов.
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
page.on('pageerror', (e) => console.log('PAGEERR', e.message))
await page.goto(process.argv[2] || 'http://127.0.0.1:3211/', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__game, { timeout: 30000 })
const wait = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
await wait(2500)

const tapInfo = async (i) => {
  const at = await page.evaluate((idx) => {
    const m = window.__game.scene.getScene('Main')
    m.state.addCash(1e9)
    m.grid.view.setScroll(idx < 4 ? 0 : -(Math.floor(idx / 2) - 1) * 152)
    m.refreshUI()
    const b = m.grid.cards[idx].infoBtn.getBounds()
    return { x: b.centerX, y: b.centerY, name: m.grid.cards[idx].def.name }
  }, i)
  await page.mouse.move(at.x, at.y)
  await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(400)
  const open = await page.evaluate(() => window.__game.scene.getScene('Main').info.isOpen)
  await page.screenshot({ path: `/tmp/info-${i}.png` })
  await page.mouse.move(195, 60)
  await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(300)
  console.log(`карточка ${i} (${at.name}): ${open ? 'открылось' : 'НЕ открылось'} -> /tmp/info-${i}.png`)
}

// Боевой слот, денежный, фанаты и трофейный (заблокированный) — четыре разных
// набора строк, и наложения в них видны только по кадру.
for (const i of [0, 4, 6, 8]) await tapInfo(i)

await browser.close()
