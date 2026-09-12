// Временный прогон доборов шага 9 живыми тапами. Удаляется после проверки.
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://localhost:3211'
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
await wait(3000)

const tap = async (x, y) => {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await wait(60)
  await page.mouse.up()
  await wait(200)
}

const findButton = (label, exact = false) => page.evaluate((lbl, ex) => {
  const scene = window.__game.scene.getScene('Main')
  const root = scene.modal ?? scene
  const out = []
  const walk = (obj, depth) => {
    if (!obj || depth > 14) return
    if (obj.txt?.text !== undefined && obj.boxW !== undefined) {
      const t = String(obj.txt.text)
      if (ex ? t === lbl : t.includes(lbl)) {
        const b = obj.getBounds()
        if (b.centerY > 0 && b.centerY < 844 && obj.visible && obj.enabled !== false) {
          out.push({ x: b.centerX, y: b.centerY, text: t })
        }
      }
    }
    for (const child of obj.list ?? []) walk(child, depth + 1)
  }
  walk(root, 0)
  return out[0] ?? null
}, label, exact)

const tapButton = async (label, exact = false) => {
  const hit = await findButton(label, exact)
  if (!hit) throw new Error('нет кнопки: ' + label)
  await tap(hit.x, hit.y)
  return hit.text
}

const ev = (fn, arg) => page.evaluate(fn, arg)
const out = []
const step = async (name, fn) => {
  try { out.push({ name, ...(await fn()) }) }
  catch (e) { out.push({ name, ok: false, why: e.message }) }
}

await step('lucky draw', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    m.state.gems = 500
    m.openShop()
    m.modal.setTab(4)
  })
  const before = await ev(() => {
    const s = window.__game.scene.getScene('Main').state
    return { left: s.luckyLeftNow, gems: s.gems }
  })
  await tapButton('Draw')
  return ev((b) => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.luckyLeftNow === b.left - 1 && s.gems < b.gems, left: s.luckyLeftNow, gems: s.gems }
  }, before)
})

await step('gift code DISCORD', async () => {
  await ev(() => window.__game.scene.getScene('Main').modal.setTab(5))
  const gems0 = await ev(() => window.__game.scene.getScene('Main').state.gems)
  for (const ch of 'DISCORD') await tapButton(ch, true)
  const typed = await ev(() => window.__game.scene.getScene('Main').modal.view.code)
  await tapButton('Redeem', true)
  const first = await ev(() => {
    const m = window.__game.scene.getScene('Main')
    return { gems: m.state.gems, msg: m.modal.view.msg.text, field: m.modal.view.code }
  })
  for (const ch of 'DISCORD') await tapButton(ch, true)
  await tapButton('Redeem', true)
  const again = await ev(() => window.__game.scene.getScene('Main').modal.view.msg.text)
  // Короткий код — сообщение о длине.
  await tapButton('DEL', true)
  await tapButton('DEL', true)
  await tapButton('DEL', true)
  await tapButton('DEL', true)
  await tapButton('DEL', true)
  await tapButton('Redeem', true)
  const short = await ev(() => window.__game.scene.getScene('Main').modal.view.msg.text)
  return {
    ok: typed === 'DISCORD' && first.gems === gems0 + 10 && first.field === ''
      && again === 'This Gift Code already used' && short.startsWith('GiftCode must be between'),
    typed, gems0, first, again, short,
  }
})

await step('albums: pack + wild', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    m.modal.close()
    m.state.collection.packs = 3
    m.state.collection.wild = 2
    m.openRewards()
    m.modal.setTab(4)
  })
  await tapButton('Open Pack')
  const mid = await ev(() => {
    const s = window.__game.scene.getScene('Main').state
    return { packs: s.collectionState.packs, wild: s.collectionState.wild }
  })
  // Тап по недостающей карте с доступной Wild Card.
  const chip = await ev(() => {
    const m = window.__game.scene.getScene('Main').modal
    for (const block of m.view.blocks) {
      for (const c of block.chips) {
        if (!c.tappable) continue
        const b = c.getBounds()
        if (b.centerY > 200 && b.centerY < 700) return { x: b.centerX, y: b.centerY }
      }
    }
    return null
  })
  if (!chip) throw new Error('нет нажимаемой карты')
  await tap(chip.x, chip.y)
  return ev((m) => {
    const s = window.__game.scene.getScene('Main').state
    return {
      ok: m.packs === 2 && s.collectionState.wild === m.wild - 1,
      packs: s.collectionState.packs, wild: s.collectionState.wild, mid: m,
    }
  }, mid)
})

await step('album claim + ultimate', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    const col = m.state.collection
    // Собираем все альбомы целиком — иначе кнопки Claim на экране нет.
    for (let a = 0; a < 4; a++) for (let c = 0; c < 9; c++) col.cards[`${a}:${c}`] = 1
    m.modal.refresh()
  })
  const gems0 = await ev(() => window.__game.scene.getScene('Main').state.gems)
  await tapButton('Claim', true)
  const claimed = await ev(() => window.__game.scene.getScene('Main').state.collection.claimed.length)
  // Остальные три альбома забираем через состояние: их кнопки лежат ниже
  // маски, и тап по ним проверял бы скролл, а не Ultimate Reward.
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    for (let i = 1; i < 4; i++) m.state.claimAlbumReward(i)
    m.modal.refresh()
  })
  const hit = await ev(() => {
    const m = window.__game.scene.getScene('Main').modal
    m.scroll.setScroll(-1500)
    m.refresh()
    const b = m.view.ultBtn.getBounds()
    return { x: b.centerX, y: b.centerY, on: m.view.ultBtn.enabled, text: m.view.ultBtn.txt.text }
  })
  await tap(hit.x, hit.y)
  return ev((a) => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.collection.ultimate && s.gems > a.gems0 && a.claimed === 1,
      claimed: a.claimed, ultimate: s.collection.ultimate, gems: s.gems, hit: a.hit }
  }, { gems0, claimed: claimed })
})

await step('outfits equip', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    m.modal.close()
    for (let i = 0; i < 3; i++) m.state.grant({ kind: 'outfit' })
    m.openCareer()
    m.modal.setTab(1)
  })
  const before = await ev(() => window.__game.scene.getScene('Main').state.extras.equipped)
  await tapButton('Equip', true)
  return ev((b) => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.extras.equipped !== b && !!s.extras.equipped, before: b, now: s.extras.equipped }
  }, before)
})

await step('avatar select', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    m.state.classes[m.state.activeClass].races = 900
    m.modal.setTab(2)
  })
  await tapButton('Select', true)
  return ev(() => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.extras.avatar !== 'rookie', avatar: s.extras.avatar }
  })
})

await step('core up', async () => {
  await ev(() => {
    const m = window.__game.scene.getScene('Main')
    m.modal.close()
    m.state.roster.create('unique')
    for (let i = 0; i < 3; i++) m.state.roster.create('pro')
    m.state.grant({ kind: 'cores', amount: 6 })
    m.openDrivers()
    m.modal.squad.scroll.setScroll(-260)
    m.modal.refresh()
  })
  const before = await ev(() => {
    const s = window.__game.scene.getScene('Main').state
    return { cores: s.extras.cores, reserves: s.roster.reserves().length }
  })
  await tapButton('Core Up')
  return ev((b) => {
    const s = window.__game.scene.getScene('Main').state
    const uni = s.roster.drivers.find((d) => d.rarity === 'unique')
    return {
      ok: s.extras.cores === b.cores - 3 && uni.coreSteps === 1
        && s.roster.reserves().length === b.reserves - 1,
      cores: s.extras.cores, steps: uni.coreSteps, reserves: s.roster.reserves().length, was: b,
    }
  }, before)
})

console.log(JSON.stringify(out, null, 1))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
