// Прогон живой страницы в headless Chrome: Phaser-ошибки видны только в
// рантайме, сборка их не ловит. Проверяем, что сцена поднялась, гонка идёт,
// апгрейд покупается, карьера и экран драйверов открываются и в них работают тапы.
//
// Тыкаем НАСТОЯЩИМИ событиями мыши, а не вызовами методов: все найденные до
// сих пор баги UI были именно во входном слое (Zone с topOnly ела клики,
// pointerdown покупал при протяжке списка).
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

// domcontentloaded, а не networkidle2: под dev-сервером Vite держит открытым
// websocket HMR, «тишины в сети» не наступает никогда, и goto падает по
// таймауту, хотя страница давно загрузилась. Готовность проверяем ниже — по
// появлению window.__game, а не по сетевой активности.
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => window.__game, { timeout: 30000 })
const wait = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
await wait(3000)

const tap = async (x, y) => {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await wait(60)
  await page.mouse.up()
  await wait(220)
}

// Центр игрового объекта в координатах страницы — чтобы не зашивать пиксели.
// Через getBounds(), а не через матрицу: у Button начало координат в центре,
// у карточки — в левом верхнем углу, а границы считаются одинаково для обоих.
const centerOf = (path) => page.evaluate((p) => {
  const obj = p.split('.').reduce((o, k) => o?.[/^\d+$/.test(k) ? Number(k) : k], window.__game.scene.getScene('Main'))
  if (!obj?.getBounds) return null
  const b = obj.getBounds()
  return { x: b.centerX, y: b.centerY }
}, path)

const tapObj = async (path) => {
  const c = await centerOf(path)
  if (!c) throw new Error('не нашёл объект: ' + path)
  await tap(c.x, c.y)
}

const steps = []
const step = async (name, fn) => {
  try { steps.push({ name, ...(await fn()) }) }
  catch (e) { steps.push({ name, ok: false, why: e.message }) }
}

// 1. Главный экран: гонка идёт, апгрейд покупается.
await step('главный экран', async () => page.evaluate(() => {
  const main = window.__game.scene.getScene('Main')
  const s = main.state
  s.addCash(1000)
  const key = s.clsDef.upgrades.find((u) => u.currency === 'cash' && s.canBuy(u.key))?.key
  return {
    ok: !!main.state && !!key && s.buy(key),
    racers: main.race?.sim?.racers?.length,
    raceLeft: Math.round(main.race?.sim?.timeLeft ?? -1),
    squadPower: Math.round(s.squadStats.off + s.squadStats.def),
    squad: s.roster.squad(s.activeClass).length,
  }
}))

// 2. Классы: CLASSES в шапке -> покупка класса -> переход в него.
// Карточки в списке разной высоты, и раскладка пересчитывается на каждом
// refresh — тап по кнопке после покупки обязан попадать туда, куда смотрит.
await step('модалка классов', async () => {
  await page.evaluate(() => window.__game.scene.getScene('Main').state.addCash(1e6))
  await tapObj('topBar.classBtn')
  const opened = await page.evaluate(() => !!window.__game.scene.getScene('Main').modal?.cards)
  await tapObj('modal.cards.1.mainBtn')          // Unlock $40K
  const unlocked = await page.evaluate(() =>
    window.__game.scene.getScene('Main').state.classes.stock.unlocked)
  await tapObj('modal.cards.1.mainBtn')          // теперь это Watch
  return page.evaluate((o) => {
    const main = window.__game.scene.getScene('Main')
    return {
      ok: o.opened && o.unlocked && main.state.activeClass === 'stock' && !main.modal,
      active: main.state.activeClass, unlocked: o.unlocked,
    }
  }, { opened, unlocked })
})

// 3. Карьера: аватар в шапке -> дерево скиллов -> вложение очка меняет силу.
await step('карьера тапами', async () => {
  await page.evaluate(() => {
    // Очки навыка капают за гонки; ждать 12 заездов в тесте незачем.
    window.__game.scene.getScene('Main').state.gainCareerXp(2000)
  })
  await tapObj('topBar.careerBtn')
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { power: Math.round(s.teamPower), free: s.careerPoints }
  })
  await tapObj('modal.nodes.0.btn')               // Racecraft +1
  return page.evaluate((b) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = s.career.spent.racecraft === 1
      && s.careerPoints === b.free - 1
      && Math.round(s.teamPower) !== b.power
    main.modal.close()
    return { ok, level: s.career.level, free: s.careerPoints, power: Math.round(s.teamPower), was: b }
  }, before)
})

// 3. Открываем драйверов тапом по нижней панели (третья вкладка).
await step('вкладка драйверов', async () => {
  await tapObj('nav.items.2.zone')
  return page.evaluate(() => {
    const m = window.__game.scene.getScene('Main').modal
    return { ok: !!m?.squad, cards: m?.squad?.cards?.length }
  })
})

// 4. Паки: даём гемов и тянем x10 — проверяем pity и пополнение резерва.
await step('гача x10', async () => {
  await page.evaluate(() => { window.__game.scene.getScene('Main').state.gems = 400 })
  await tapObj('modal.tabs.1')
  await tapObj('modal.packs.rows.0.b10')
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.roster.reserves().length >= 10, reserves: s.roster.reserves().length, gems: s.gems }
  })
})

// 5. Состав: выбрать резервного и скормить его цели (тренировка).
await step('тренировка тапами', async () => {
  await tapObj('modal.tabs.0')
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    const t = s.roster.get(window.__game.scene.getScene('Main').modal.squad.targetUid)
    return { xp: t.totalXp, reserves: s.roster.reserves().length }
  })
  await tapObj('modal.squad.cards.5.card')      // первая карточка резерва
  await tapObj('modal.squad.actions.1')         // «Скормить»
  return page.evaluate(({ xp, reserves }) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const t = s.roster.get(main.modal.squad.targetUid)
    return {
      ok: t.totalXp > xp && s.roster.reserves().length === reserves - 1,
      xpGain: t.totalXp - xp, level: t.level,
    }
  }, before)
})

// 6. Резервный встаёт в состав — сила команды обязана измениться.
await step('замена в составе', async () => {
  const before = await page.evaluate(() => Math.round(window.__game.scene.getScene('Main').state.teamPower))
  await tapObj('modal.squad.cards.5.card')
  await tapObj('modal.squad.actions.0')         // «В состав»
  return page.evaluate((p) => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: Math.round(s.teamPower) !== p, power: Math.round(s.teamPower), was: p }
  }, before)
})

// 7. «АВТО» — merge дубликатов, топ-5 в состав, остальных в корм. Этой же
// функцией ходит бот в балансном стенде, поэтому падение здесь = сломанный sim.
await step('автосостав', async () => {
  await tapObj('modal.autoBtn')
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { ok: s.roster.reserves().length === 0, power: Math.round(s.teamPower) }
  })
})

// 8. Закрытие: сейв переживает перезагрузку страницы.
await step('сейв и закрытие', async () => {
  await page.evaluate(() => {
    const main = window.__game.scene.getScene('Main')
    main.modal.close()
    main.state.save()
  })
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { drivers: s.roster.drivers.length, power: Math.round(s.teamPower), skills: s.career.spent.racecraft }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__game?.scene?.getScene('Main')?.state, { timeout: 30000 })
  await wait(1500)
  return page.evaluate((b) => {
    const s = window.__game.scene.getScene('Main').state
    return {
      ok: s.roster.drivers.length === b.drivers && Math.round(s.teamPower) === b.power
        && s.career.spent.racecraft === b.skills,
      drivers: s.roster.drivers.length, power: Math.round(s.teamPower),
      skills: s.career.spent.racecraft, was: b,
    }
  }, before)
})

await browser.close()

console.log(JSON.stringify(steps, null, 2))
if (errors.length) {
  console.log('\nОШИБКИ КОНСОЛИ:')
  for (const e of errors.slice(0, 10)) console.log('  ' + e)
}
const failed = steps.filter((s) => !s.ok)
console.log(failed.length || errors.length
  ? `\nПРОВАЛ: ${failed.map((s) => s.name).join(', ') || 'ошибки консоли'}`
  : '\nOK')
process.exit(failed.length || errors.length ? 1 : 0)
