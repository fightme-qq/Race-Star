// Скриншот экрана в headless Chrome. Нужен там, где smoke бессилен: он
// проверяет логику («очко вложилось»), но не видит НАЛОЖЕНИЙ. Этой командой
// поймана регрессия шапки — кнопка классов накрыла собой значение Income /s,
// и все тапы при этом проходили.
//
//   node tools/shot.mjs [экран] [файл]
//   экран: main | career | drivers | classes
import { launch, goto, scrollDown, SCREENS } from './screens.mjs'

const SCREEN = process.argv[2] || 'career'
const OUT = process.argv[3] || `/tmp/${SCREEN}.png`
if (!SCREENS[SCREEN]) {
  console.error(`нет экрана «${SCREEN}», есть: ${Object.keys(SCREENS).join(', ')}`)
  process.exit(1)
}

const { browser, page } = await launch()
await goto(page, SCREEN)
await page.screenshot({ path: OUT })

const scrolled = OUT.replace(/\.png$/, '2.png')
const ok = await scrollDown(page)
if (ok) await page.screenshot({ path: scrolled })

await browser.close()
console.log(OUT + (ok ? ` и ${scrolled}` : ''))
