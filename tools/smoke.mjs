// Прогон живой страницы в headless Chrome: Phaser-ошибки видны только в
// рантайме, сборка их не ловит. Проверяем, что сцена поднялась, гонка идёт,
// апгрейд покупается и в консоли нет ошибок.
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://localhost:3111'
const CHROME = '/usr/bin/google-chrome'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await page.evaluate(() => new Promise((r) => setTimeout(r, 4000)))

const probe = await page.evaluate(() => {
  const g = window.__game
  if (!g) return { ok: false, why: 'window.__game не появился' }
  const main = g.scene.getScene('Main')
  if (!main?.state) return { ok: false, why: 'сцена Main не поднялась' }
  const s = main.state
  const before = { cash: s.cash, income: s.incomePerSec }
  // Копим деньги и покупаем первый доступный апгрейд напрямую через систему.
  s.addCash(1000)
  const key = s.clsDef.upgrades.find((u) => u.currency === 'cash' && s.canBuy(u.key))?.key
  const bought = key ? s.buy(key) : false
  return {
    ok: true, before, bought, key,
    level: key ? s.levelOf(key) : 0,
    income: s.incomePerSec,
    scenes: g.scene.scenes.map((x) => x.scene.key + ':' + x.scene.isActive()),
    raceLeft: main.race?.sim?.timeLeft,
    racers: main.race?.sim?.racers?.length,
    playerPos: main.race?.sim?.player?.position,
  }
})

await browser.close()

console.log(JSON.stringify(probe, null, 2))
if (errors.length) {
  console.log('\nОШИБКИ КОНСОЛИ:')
  for (const e of errors.slice(0, 10)) console.log('  ' + e)
}
const fail = !probe.ok || !probe.bought || errors.length > 0
console.log(fail ? '\nПРОВАЛ' : '\nOK')
process.exit(fail ? 1 : 0)
