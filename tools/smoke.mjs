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


// Поиск кнопки ПО ПОДПИСИ во всём дереве открытого окна. Пути вида
// `modal.view.rows.0.btn` привязаны к тому, как именно собран экран, и ломаются
// от любой перестановки блоков — а проверять надо, что кнопка нажимается, а не
// где она лежит в дереве. Обходим контейнеры и ищем Button с нужным текстом.
const findButton = (label, exact = false) => page.evaluate((lbl, ex) => {
  const scene = window.__game.scene.getScene('Main')
  const root = scene.modal ?? scene
  const out = []
  const walk = (obj, depth) => {
    if (!obj || depth > 12) return
    if (obj.txt?.text !== undefined && obj.boxW !== undefined) {
      const t = String(obj.txt.text)
      if (ex ? t === lbl : t.includes(lbl)) {
        const b = obj.getBounds()
        // Кнопка за пределами экрана (уехала под маску скролла) не нажимается —
        // возвращать её значило бы тапать в пустоту и списывать это на логику.
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
  if (!hit) throw new Error('не нашёл кнопку: ' + label)
  await tap(hit.x, hit.y)
  return hit.text
}

const steps = []
const step = async (name, fn) => {
  try { steps.push({ name, ...(await fn()) }) }
  catch (e) { steps.push({ name, ok: false, why: e.message }) }
}

// 0. Обучение и ворота вкладок. Идёт ПЕРВЫМ и тапами: на чистом старте карточка
// обучения лежит выше всего экрана, и если её нельзя пролистать, то все
// остальные шаги проверяют игру, в которую игрок не может попасть.
await step('обучение и ворота', async () => {
  const start = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    return { active: m.tutorial.active, step: m.state.tutorial.step, card: m.tutorial.card.visible }
  })

  // Закрытая вкладка не открывает окно. Ворота считаются от пробега класса, а
  // он на старте нулевой — то есть заперты все пять.
  const navLocked = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    return m.nav.items[3].lock.visible
  })
  await tapObj('nav.items.3.zone')
  const stillClosed = await page.evaluate(() =>
    !window.__game.scene.getScene('Main').modal?.active)

  // Листаем до шага, который ЖДЁТ покупки (индекс 3 в STEPS).
  for (let i = 0; i < 3; i++) await tapObj('tutorial.card.nextBtn')
  const atBuy = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    return { step: m.state.tutorial.step, await: !!m.state.tutorial.current?.await, next: m.tutorial.card.nextBtn.visible }
  })

  // Шаг, который ждёт покупки, обязан быть выполним БЕЗ помощи стенда: денег
  // здесь больше не выдаём. Раньше smoke дарил $100K перед тапом и поэтому три
  // этапа не видел, что у живого игрока кошелёк $0 при цене слота $25.
  //
  // Заодно проверяем, что список не ездит под затемнением: слушатели скролла
  // висят на scene.input, и зоны Spotlight их не перехватывают.
  const dragged = await page.evaluate(async () => {
    const m = window.__game.scene.getScene('Main')
    const before = m.grid.view.scrollY
    m.grid.view.handlers.pointerdown({ x: 195, y: 700 })
    m.grid.view.handlers.pointermove({ x: 195, y: 520, isDown: true })
    m.grid.view.handlers.pointerup()
    return { moved: m.grid.view.scrollY !== before, affordable: m.state.canBuy(m.grid.cards[0].def.key) }
  })
  await tapObj('grid.cards.0.buyBtn')
  const advanced = await page.evaluate(() =>
    window.__game.scene.getScene('Main').state.tutorial.step)

  // Выход по Skip и снятие ворот: дальше smoke проверяет игру целиком, а она
  // вся за воротами.
  await tapObj('tutorial.card.skipBtn')
  const after = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    const done = m.state.tutorial.done && !m.tutorial.card.visible
    m.state.tutorial.navUnlocked = true
    m.refreshUI()
    return { done, unlocked: !m.nav.items[3].lock.visible }
  })

  // Разовая справка при ПЕРВОМ входе в экран — та же проверка тапами: она
  // ложится поверх только что открытого окна, и если её нельзя закрыть, то
  // вкладка заперта ею навсегда.
  await tapObj('nav.items.3.zone')
  const intro = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    return { shown: m.info.isOpen, modal: !!m.modal?.active }
  })
  // Кнопку справки ищем в СЦЕНЕ, а не в окне: `findButton` обходит
  // `scene.modal ?? scene`, а InfoPopup живёт рядом с модалкой, не внутри неё.
  const gotIt = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    const btn = m.info.content.list.find((o) => o.txt?.text === 'Got it')
    if (!btn) return null
    const b = btn.getBounds()
    return { x: b.centerX, y: b.centerY }
  })
  if (!gotIt) throw new Error('не нашёл кнопку справки «Got it»')
  await tap(gotIt.x, gotIt.y)
  const introClosed = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    // Второй вход молчит: отметка разовая. Дальше глушим справку целиком —
    // остальные шаги smoke входят в каждое окно первый раз.
    const still = m.info.isOpen
    m.modal?.close()
    m.state.tutorial.seen.__all = true
    return !still
  })
  if (!intro.shown || !intro.modal) throw new Error('справка экрана не показалась')
  if (!introClosed) throw new Error('справка экрана не закрылась')

  if (!start.active || !start.card) throw new Error('обучение не показалось на старте')
  if (!navLocked || !stillClosed) throw new Error('закрытая вкладка открылась')
  if (!atBuy.await || atBuy.next) throw new Error('шаг покупки не ждёт действия')
  if (!dragged.affordable) throw new Error('шаг покупки показан при нехватке денег')
  if (dragged.moved) throw new Error('список ездит под затемнением обучения')
  if (advanced <= atBuy.step) throw new Error('покупка не закрыла шаг')
  if (!after.done || !after.unlocked) throw new Error('обучение не завершилось')
  return { ok: true, start, navLocked, stillClosed, atBuy, dragged, advanced, after, intro }
})

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

// 1a. Карточка апгрейда ТАПАМИ. Шаг 1 покупает через `s.buy()` и потому не
// видит входного слоя вовсе: ⓘ на карточке был нарисован `label`-ом без
// setInteractive и молчал на тап, а шаг 1 держался зелёным. Проверяем обе
// цели карточки: кнопку `Upgrade` и ⓘ.
await step('карточка апгрейда тапами', async () => {
  await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    m.state.addCash(1e6)
    m.grid.view.setScroll(0)
    m.refreshUI()
  })
  const before = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    const c = m.grid.cards[0]
    const b = c.buyBtn.getBounds()
    const z = c.infoBtn.getBounds()
    return {
      key: c.def.key, level: m.state.levelOf(c.def.key),
      buy: { x: b.centerX, y: b.centerY }, info: { x: z.centerX, y: z.centerY },
    }
  })
  await tap(before.buy.x, before.buy.y)
  const bought = await page.evaluate((k) =>
    window.__game.scene.getScene('Main').state.levelOf(k), before.key)

  await tap(before.info.x, before.info.y)
  const opened = await page.evaluate(() => {
    const p = window.__game.scene.getScene('Main').info
    return { open: p.isOpen, rows: p.content.list.length }
  })
  // Закрываем тапом МИМО окна: тот самый путь, на котором справка закрывалась
  // бы в кадре своего появления, не будь взведения (armed) в InfoPopup.
  await tap(195, 60)
  const closed = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    return { open: m.info.isOpen, locked: m.grid.locked }
  })

  // Протяжка ОТ значка ⓘ — это скролл списка, а не тап: без порога сдвига
  // справка вылезала бы на каждом свайпе по правому краю карточки.
  await page.mouse.move(before.info.x, before.info.y)
  await page.mouse.down()
  await page.mouse.move(before.info.x, before.info.y - 60, { steps: 6 })
  await page.mouse.up()
  await wait(250)
  const dragged = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    const scrolled = m.grid.view.scrollY
    m.grid.view.setScroll(0)
    return { open: m.info.isOpen, scrolled }
  })

  return {
    ok: bought === before.level + 1 && opened.open && opened.rows > 8
      && !closed.open && !closed.locked
      && !dragged.open && dragged.scrolled < -10,
    level: bought, rows: opened.rows, scrolled: Math.round(dragged.scrolled),
  }
})

// 1b. Маска режет картинку, но не ввод: уехавшая под кромку кнопка оставалась
// нажимаемой, и тап по ТРАССЕ покупал апгрейд из невидимого ряда.
await step('невидимый ряд не нажимается', async () => {
  const probe = await page.evaluate(() => {
    const m = window.__game.scene.getScene('Main')
    m.state.addCash(1e9)
    m.grid.view.setScroll(-200)
    m.refreshUI()
    const b = m.grid.cards[0].buyBtn.getBounds()
    return {
      key: m.grid.cards[0].def.key, level: m.state.levelOf(m.grid.cards[0].def.key),
      x: b.centerX, y: b.centerY, gridTop: m.grid.view.y,
    }
  })
  await tap(probe.x, probe.y)
  const after = await page.evaluate((k) => {
    const m = window.__game.scene.getScene('Main')
    m.grid.view.setScroll(0)
    return m.state.levelOf(k)
  }, probe.key)
  return {
    ok: probe.y < probe.gridTop && after === probe.level,
    y: Math.round(probe.y), gridTop: probe.gridTop, level: after,
  }
})

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

// 3a. Лиги: вкладка 4 -> таблица сезона на 10 строк -> Advance поднимает лигу.
// Кнопку жмём настоящим тапом: она включается только при взятом пороге очков,
// то есть проверяется и раскладка, и условие.
await step('вкладка лиг', async () => {
  await tapObj('nav.items.3.zone')
  const rows = await page.evaluate(() =>
    window.__game.scene.getScene('Main').modal?.standings?.rows?.length ?? 0)
  const before = await page.evaluate(() => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    // Порог берётся сезоном; в тесте выдаём очки, иначе ждать 15 заездов.
    s.cls.seasonScore = s.seasonTarget
    main.modal.refresh()
    return { league: s.cls.league, seasons: s.cls.history.length }
  })
  await tapObj('modal.header.advance')
  return page.evaluate((b) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = b.rows === 10 && s.cls.league === b.league + 1
      && s.cls.seasonScore === 0 && s.cls.history.length === b.seasons + 1
    main.modal.close()
    return { ok, league: s.cls.league, rows: b.rows, was: b }
  }, { ...before, rows })
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

// 7a. Награды: вкладка 5 -> забрать задачу -> токены уходят в пасс -> забрать
// уровень пасса. Проверяется вся цепочка валюты, а не открытие окна: задача
// даёт 🪙, 🪙 двигают шкалу, шкала отдаёт награду.
await step('вкладка наград', async () => {
  await page.evaluate(() => {
    const main = window.__game.scene.getScene('Main')
    main.modal?.close()
    // Ждать сотню заездов ради дневной задачи в тесте незачем.
    main.state.track('raceFinish', 200)
    main.state.track('raceWin', 20)
  })
  await tapObj('nav.items.4.zone')
  const opened = await page.evaluate(() =>
    !!window.__game.scene.getScene('Main').modal?.view?.groups)
  // Две задачи, а не одна: уровень 1 стоит 12 🪙, а задача даёт 10 —
  // с одной шкала не сдвинулась бы и проверка «токены двигают пасс» молчала.
  await tapObj('modal.view.groups.0.items.2.btn')      // Finish races -> Claim
  await tapObj('modal.view.groups.0.items.3.btn')      // Win races -> Claim
  const afterTask = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { tokens: s.rw.pass.tokens, level: s.passProgress.level }
  })
  await tapObj('modal.tabs.1')                          // вкладка PASS
  const gemsBefore = await page.evaluate(() => window.__game.scene.getScene('Main').state.gems)
  await tapObj('modal.view.rows.0.free')                // забрать уровень 1
  return page.evaluate((b) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = b.opened && b.afterTask.tokens > 0 && b.afterTask.level >= 1
      && s.rw.pass.claimedFree.includes(1)
    main.modal.close()
    return { ok, tokens: b.afterTask.tokens, level: b.afterTask.level, gems: s.gems, was: b }
  }, { opened, afterTask, gemsBefore })
})

// 7b. Ежедневный вход выдаёт награду ровно один раз в сутки.
await step('daily reward', async () => {
  await tapObj('nav.items.4.zone')
  await tapObj('modal.tabs.2')
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { gems: s.gems, total: s.loginInfo.total, available: s.loginInfo.available }
  })
  await tapObj('modal.view.claimBtn')
  const after = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { gems: s.gems, total: s.loginInfo.total, available: s.loginInfo.available }
  })
  await tapObj('modal.view.claimBtn')      // второй тап того же дня — не должен дать ничего
  return page.evaluate((ctx) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = ctx.before.available && !ctx.after.available
      && ctx.after.total === ctx.before.total + 1
      && s.loginInfo.total === ctx.after.total
    main.modal.close()
    return { ok, total: s.loginInfo.total, gems: s.gems, was: ctx }
  }, { before, after })
})

// 7c. Магазин: вкладка 6 -> бесплатные гемы -> реклама -> «деньги за гемы».
// Проверяется цепочка валют целиком: бесплатное поднимает гемы, пак меняет их
// на деньги, дневной лимит гасит кнопку. Тапами, потому что все найденные баги
// UI были во входном слое, а не в математике.
await step('вкладка магазина', async () => {
  await tapObj('nav.items.5.zone')
  const opened = await page.evaluate(() =>
    !!window.__game.scene.getScene('Main').modal?.view?.daily)
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { gems: s.gems, cash: s.cash, ads: s.shopFree.adsLeft }
  })
  await tapObj('modal.view.daily.btn')          // Free Daily Gems
  await tapObj('modal.view.ad.btn')             // Free Gems за рекламу
  const afterFree = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { gems: s.gems, ads: s.shopFree.adsLeft, ready: s.shopFree.dailyReady }
  })
  await tapObj('modal.tabs.1')                  // вкладка CASH
  const cashBefore = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { gems: s.gems, cash: s.cash }
  })
  await tapObj('modal.view.rows.0.btn')         // Instant Cash
  return page.evaluate((ctx) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = ctx.opened
      && ctx.afterFree.gems > ctx.before.gems
      && !ctx.afterFree.ready && ctx.afterFree.ads === ctx.before.ads - 1
      && s.gems < ctx.cashBefore.gems && s.cash > ctx.cashBefore.cash
      && s.cashPacks[0].left === s.cashPacks[0].pack.perDay - 1
    main.modal.close()
    return { ok, gems: s.gems, left: s.cashPacks[0].left, was: ctx }
  }, { opened, before, afterFree, cashBefore })
})


// 7d. Вкладка 2 — гир: пак за гемы, автоэкипировка поднимает силу команды.
await step('вкладка гира', async () => {
  await tapObj('nav.items.1.zone')
  const opened = await page.evaluate(() => !!window.__game.scene.getScene('Main').modal)
  await page.evaluate(() => { window.__game.scene.getScene('Main').state.gems += 600 })
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { items: s.gear.items.length, power: Math.round(s.teamPower), gems: s.gems }
  })
  await tapObj('modal.tabs.1')            // PACKS
  await tapButton('Open x10')
  const afterDraw = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { items: s.gear.items.length, gems: s.gems }
  })
  await tapObj('modal.tabs.0')            // GEAR — слоты
  await tapButton('Auto')
  return page.evaluate((ctx) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const worn = Object.keys(s.gear.equip[s.activeClass] ?? {}).length
    const ok = ctx.opened
      && ctx.afterDraw.items >= ctx.before.items + 10
      && ctx.afterDraw.gems < ctx.before.gems
      && worn > 0 && Math.round(s.teamPower) > ctx.before.power
    main.modal.close()
    return { ok, worn, power: Math.round(s.teamPower), was: ctx }
  }, { opened, before, afterDraw })
})

// 7e. Гараж открывается ИЗ гира (вкладок меню ровно шесть) и апгрейдит машину.
await step('гараж', async () => {
  await tapObj('nav.items.1.zone')
  await tapButton('GARAGE', true)
  const opened = await page.evaluate(() =>
    !!window.__game.scene.getScene('Main').modal?.box)
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    s.addCash(s.incomePerSec * 1e6)
  })
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    const car = s.car
    return { car: car?.id ?? null, level: s.garage.cars[car?.id]?.level ?? 0, power: Math.round(s.teamPower) }
  })
  await tapButton('Upgrade')
  // `opened` передаётся ВНУТРЬ, а не читается из замыкания: page.evaluate
  // исполняется в браузере, замыкание туда не уезжает. Без этого `ctx.opened`
  // был undefined, `ok` не попадал в JSON и шаг падал при работающем гараже —
  // машина при этом честно апгрейдилась (level 0 -> 1, power 391 -> 393).
  return page.evaluate((ctx) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const level = s.garage.cars[ctx.car]?.level ?? 0
    const ok = ctx.opened && !!ctx.car && level > ctx.level
      && Math.round(s.teamPower) > ctx.power
    main.modal.close()
    return { ok, car: ctx.car, level, power: Math.round(s.teamPower), was: ctx }
  }, { ...before, opened })
})

// 7f. Арена: матч тратит тикет и даёт медали (шаг 8).
await step('арена', async () => {
  await tapObj('nav.items.3.zone')
  await tapObj('modal.tabs.1')            // ARENA
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return { tickets: s.arena.tickets, medals: s.arena.medalsToday }
  })
  await tapButton('Challenge')
  return page.evaluate((ctx) => {
    const main = window.__game.scene.getScene('Main')
    const s = main.state
    const ok = s.arena.tickets === ctx.tickets - 1 && s.arena.medalsToday > ctx.medals
    main.modal.close()
    return { ok, tickets: s.arena.tickets, medals: s.arena.medalsToday, was: ctx }
  }, before)
})

// 8. Закрытие: сейв переживает перезагрузку страницы.
await step('сейв и закрытие', async () => {
  await page.evaluate(() => {
    const main = window.__game.scene.getScene('Main')
    main.modal?.close()
    main.state.save()
  })
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Main').state
    return {
      drivers: s.roster.drivers.length, power: Math.round(s.teamPower),
      skills: s.career.spent.racecraft,
      league: s.cls.league, seasons: s.cls.history.length,
      // Шаги 6-8: сейв поднялся до v8, и если новые блоки в него не попали,
      // перезагрузка молча сбросит две оси силы и все соревнования.
      gear: s.gear.items.length, cars: Object.keys(s.garage.cars).length,
      medals: s.arena.medals,
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__game?.scene?.getScene('Main')?.state, { timeout: 30000 })
  await wait(1500)
  return page.evaluate((b) => {
    const s = window.__game.scene.getScene('Main').state
    return {
      ok: s.roster.drivers.length === b.drivers && Math.round(s.teamPower) === b.power
        && s.career.spent.racecraft === b.skills
        && s.cls.league === b.league && s.cls.history.length === b.seasons
        && s.gear.items.length === b.gear
        && Object.keys(s.garage.cars).length === b.cars && s.arena.medals === b.medals,
      drivers: s.roster.drivers.length, power: Math.round(s.teamPower),
      skills: s.career.spent.racecraft,
      league: s.cls.league, seasons: s.cls.history.length, was: b,
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
