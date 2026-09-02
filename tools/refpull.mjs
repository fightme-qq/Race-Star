// Скачивает референс-кадры оригинала заново. Полноразмерные оригиналы кладёт
// в teardown/ref/store/ (в git не хранятся — 40 МБ), рабочие 780px копии —
// в teardown/ref/, они и коммитятся.
//
// Источник — App Store lookup API. Это единственный публичный источник кадров
// без маркетинговых наложений: Play даёт только иконку и ролики ЧУЖИХ игр из
// блока рекомендаций (проверено — все 6 youtube-id со страницы оказались
// рекламой других приложений).
//
//   node tools/refpull.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const APPS = [
  { id: 6782871814, tag: 'racestar' },
  { id: 6793136442, tag: 'trackstar' }, // тот же движок, рескин в лёгкую атлетику
]

// Кадр → имя экрана. Всё, чего здесь нет, остаётся только в store/.
const MAP = {
  'racestar-ph-still024': 'main-early',
  'racestar-ph-still027': 'main-oval',
  'racestar-ph-still028': 'main-figure8',
  'racestar-ph-still029': 'main-late',
  'racestar-ph-still030': 'main-dirt',
  'racestar-ph-still025': 'drivers',
  'racestar-ph-still026': 'career',
  'racestar-pad-still013': 'pad-main-economy',
  'racestar-pad-still014': 'pad-drivers9',
  'racestar-pad-still015': 'pad-main-late',
  'racestar-pad-still016': 'pad-main-economy2',
  'racestar-pad-still017': 'pad-main-oval',
  'racestar-pad-still018': 'pad-classes',
  'racestar-pad-still021': 'pad-career',
  'trackstar-ph-still002': 'trackstar/economy-lv5',
  'trackstar-ph-still004': 'trackstar/main-sprint',
  'trackstar-ph-still005': 'trackstar/main-swim',
  'trackstar-ph-still006': 'trackstar/career-node',
  'trackstar-pad-still007': 'trackstar/pad-career',
  'trackstar-pad-still001': 'trackstar/pad-main-sprint',
  'trackstar-pad-still003': 'trackstar/pad-main-swim',
}

const REF = new URL('../teardown/ref/', import.meta.url).pathname
const STORE = REF + 'store/'
const exec = promisify(execFile)

await mkdir(STORE, { recursive: true })
await mkdir(REF + 'trackstar/', { recursive: true })

const grabbed = []
for (const { id, tag } of APPS) {
  const meta = await (await fetch(`https://itunes.apple.com/lookup?id=${id}&country=us`)).json()
  const app = meta.results[0]
  console.log(`${tag}: ${app.trackName} v${app.version}`)
  const shots = [
    ...(app.screenshotUrls ?? []).map((u) => ['ph', u]),
    ...(app.ipadScreenshotUrls ?? []).map((u) => ['pad', u]),
  ]
  for (const [kind, url] of shots) {
    // Суффикс размера в CDN-ссылке заменяемый: 320x480bb.jpg → полный кадр.
    const full = url.replace(/\/\d+x\d+bb\.jpg$/, '/2400x0w.png')
    const still = url.match(/Still(\d+)/)?.[1] ?? String(shots.indexOf(url))
    const name = `${tag}-${kind}-still${still}`
    const buf = Buffer.from(await (await fetch(full)).arrayBuffer())
    await writeFile(STORE + name + '.png', buf)
    grabbed.push(name)
  }
}
console.log(`store/: ${grabbed.length} кадров`)

// Пережимаем в 780px — вдвое шире нашего вьюпорта, текст ещё читается,
// а весь набор влезает в 9 МБ вместо 40.
let made = 0
for (const [src, dst] of Object.entries(MAP)) {
  if (!grabbed.includes(src)) {
    console.warn(`НЕТ КАДРА ${src} → ${dst}: витрина сменила скриншоты, поправь MAP`)
    continue
  }
  await exec('convert', [`${STORE}${src}.png`, '-resize', '780x', `${REF}${dst}.png`])
  made++
}
console.log(`ref/: ${made} рабочих копий`)
