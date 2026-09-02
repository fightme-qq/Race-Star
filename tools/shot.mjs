// Скриншот экрана в headless Chrome. Нужен там, где smoke бессилен: он
// проверяет логику («очко вложилось»), но не видит НАЛОЖЕНИЙ. Этой командой
// поймана регрессия шапки — кнопка классов накрыла собой значение Income /s,
// и все тапы при этом проходили.
//
//   node tools/shot.mjs [экран] [файл]
//   экран: main | career | drivers | classes
import puppeteer from 'puppeteer-core'

const SCREEN = process.argv[2] || 'career'
const OUT = process.argv[3] || `/tmp/${SCREEN}.png`
const URL = process.env.URL || 'http://localhost:3111'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__game)
const wait = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
await wait(2500)

// Ресурсы выдаём щедро: пустой экран не показывает ни одной активной кнопки,
// а проверять надо именно живое состояние.
await page.evaluate((screen) => {
  const main = window.__game.scene.getScene('Main')
  main.state.gainCareerXp(9000)
  main.state.gems = 500
  main.state.addCash(1e6)
  if (screen === 'career') main.openCareer()
  if (screen === 'drivers') main.openDrivers()
  if (screen === 'classes') main.openClasses()
}, SCREEN)
await wait(800)
await page.screenshot({ path: OUT })

// Второй кадр — список, прокрученный вниз: обрезка маской и нижние кнопки
// видны только там.
const scrolled = OUT.replace(/\.png$/, '2.png')
const ok = await page.evaluate(() => {
  const m = window.__game.scene.getScene('Main').modal
  const scroll = m?.scroll ?? m?.squad?.scroll
  if (!scroll) return false
  scroll.setScroll(-420)
  m.refresh()
  return true
})
if (ok) {
  await wait(500)
  await page.screenshot({ path: scrolled })
}

await browser.close()
console.log(OUT + (ok ? ` и ${scrolled}` : ''))
