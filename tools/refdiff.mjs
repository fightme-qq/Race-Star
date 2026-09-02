// Ставит наш экран рядом с кадром оригинала, приведённым к той же высоте.
// Без этого требование «1 в 1 по визуалу» непроверяемо: на память композиция
// и палитра не сравниваются, а расхождения (тёмная тема против светлой)
// становятся видны только когда кадры стоят борт о борт.
//
//   node tools/refdiff.mjs [экран] [файл]
//   node tools/refdiff.mjs all
import { readFile, writeFile } from 'node:fs/promises'
import { launch, goto, VIEWPORT } from './screens.mjs'

const REF = new URL('../teardown/ref/', import.meta.url).pathname
const index = JSON.parse(await readFile(REF + 'index.json', 'utf8'))
const arg = process.argv[2] || 'all'
const names = arg === 'all' ? Object.keys(index.screens) : [arg]

const H = 900 // высота панелей в собранном кадре
const b64 = async (p) => 'data:image/png;base64,' + (await readFile(p)).toString('base64')

const { browser, page } = await launch()
const out = []

for (const name of names) {
  const meta = index.screens[name]
  if (!meta) {
    console.error(`нет референса для «${name}», есть: ${Object.keys(index.screens).join(', ')}`)
    continue
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__game)
  await page.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  await goto(page, name)
  const ours = 'data:image/png;base64,' + (await page.screenshot({ encoding: 'base64' }))
  const ref = await b64(REF + meta.ref)

  const file = process.argv[3] || `/tmp/diff-${name}.png`
  await renderPair(page, { name, meta, ref, ours, file })
  out.push(file)
  console.log(`${name}: ${file}  (референс ${meta.ref}, ${meta.aspect})`)
  if (meta.warn) console.log(`  ! ${meta.warn}`)
}

await browser.close()
if (!out.length) process.exit(1)

// Сборка делается той же вкладкой Chrome, а не библиотекой обработки картинок:
// лишняя зависимость ради двух <img> рядом не нужна.
async function renderPair(page, { name, meta, ref, ours, file }) {
  const W = Math.round((H * VIEWPORT.width) / VIEWPORT.height)
  await page.setViewport({ width: W * 2 + 30, height: H + 46 })
  await page.setContent(`<!doctype html><meta charset=utf-8>
<style>
 body{margin:0;background:#1b1d22;font:12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#cfd3da}
 .row{display:flex;gap:10px;padding:5px}
 figure{margin:0}
 figcaption{padding:4px 2px;letter-spacing:.04em;text-transform:uppercase}
 img{display:block;height:${H}px;background:#000}
 .ref img{width:auto}
 .ours img{width:${W}px}
 b{color:#7fd07f}
</style>
<div class=row>
 <figure class=ref><figcaption>оригинал — ${meta.ref} <b>${meta.aspect}</b></figcaption><img src="${ref}"></figure>
 <figure class=ours><figcaption>наш — ${name}</figcaption><img src="${ours}"></figure>
</div>`)
  await page.evaluate(() => Promise.all(Array.from(document.images, (i) => i.decode())))
  const buf = await page.screenshot({ fullPage: true })
  await writeFile(file, buf)
  await page.setViewport(VIEWPORT)
}
