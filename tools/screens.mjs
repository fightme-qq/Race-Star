// Общий драйвер экранов для shot.mjs и refdiff.mjs: открыть браузер, довести
// игру до нужного экрана, снять кадр. Держим в одном месте, потому что иначе
// «наш кадр» у скриншотера и у сверки с оригиналом расходится, и сравнивать
// становится нечего.
import puppeteer from 'puppeteer-core'

export const VIEWPORT = { width: 390, height: 844 }

// Состояние подгоняем под тот кадр оригинала, с которым сверяемся: на кадре
// main апгрейды нулевого уровня, а карьера и драйверы показаны прокачанными.
export const SCREENS = {
  // На кадре оригинала апгрейды нулевого уровня, но денег 219M и кнопки
  // активны — иначе сверяется цвет «нельзя купить», которого на кадре нет.
  main: { open: null, cash: 1e6 },
  career: { open: 'openCareer', cash: 1e6 },
  drivers: { open: 'openDrivers', cash: 1e6 },
  classes: { open: 'openClasses', cash: 1e6 },
}

export async function launch() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)
  await page.goto(process.env.URL || 'http://localhost:3111', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__game)
  await wait(page, 2500)
  return { browser, page }
}

export const wait = (page, ms) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)

export async function goto(page, screen) {
  const cfg = SCREENS[screen]
  if (!cfg) throw new Error(`нет экрана «${screen}», есть: ${Object.keys(SCREENS).join(', ')}`)
  await page.evaluate((c) => {
    const main = window.__game.scene.getScene('Main')
    // Пустой экран не показывает ни одной активной кнопки, а проверять надо
    // живое состояние — поэтому ресурсы выдаём щедро.
    main.state.gainCareerXp(9000)
    main.state.gems = 500
    if (c.cash) main.state.addCash(c.cash)
    if (c.open) main[c.open]()
  }, cfg)
  await wait(page, 800)
}

// Второй кадр — список, прокрученный вниз: обрезка маской и нижние кнопки
// видны только там.
export async function scrollDown(page, px = -420) {
  const ok = await page.evaluate((d) => {
    const m = window.__game.scene.getScene('Main').modal
    const scroll = m?.scroll ?? m?.squad?.scroll
    if (!scroll) return false
    scroll.setScroll(d)
    m.refresh()
    return true
  }, px)
  if (ok) await wait(page, 500)
  return ok
}
