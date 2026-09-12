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
  // Обучение. Снимаем ТРИ шага, а не один: карточка сама выбирает, встать ей
  // выше или ниже подсветки, и наложение возможно только на конкретной цели —
  // приветствие без цели, статы у верхней кромки, карточка апгрейда у нижней.
  tutorial: { open: null, tutorial: 1 },
  tutorialStats: { open: null, tutorial: 3 },
  tutorialBuy: { open: null, cash: 1e6, tutorial: 4 },
  // Разовая справка при первом входе в экран: текст в ней самый длинный из
  // всех, что видело это окно, и обрезка проверяется только кадром.
  introLeagues: { open: 'openLeagues', cash: 1e6, races: 14, intro: true },
  introGear: { open: 'openGear', cash: 1e6, races: 30, draw: 20, intro: true },
  career: { open: 'openCareer', cash: 1e6 },
  drivers: { open: 'openDrivers', cash: 1e6 },
  classes: { open: 'openClasses', cash: 1e6 },
  // Кадра оригинала для вкладки лиг нет (её нет ни на одном из 42), поэтому
  // экран снимается только для `shot`: проверить наложения и обрезку маской.
  // `races` прокатывает сезон заранее — на пустой таблице все нули, и ни
  // сортировка, ни подсветка строки игрока не проверяются.
  leagues: { open: 'openLeagues', cash: 1e6, races: 14 },
  // Кадра оригинала нет и здесь: это состояние «открыто три класса», в котором
  // видна строка параллельного дохода. Отдельный экран, а не правка `main`:
  // `main` сверяется с main-early.png, где класс ровно один.
  // Вкладка наград — четыре вида в одном окне, и каждый надо снимать отдельно:
  // наложения ловятся только глазами, а видны они лишь на своей вкладке.
  // `races` нужны, чтобы счётчики задач и почта не были пустыми.
  rewards: { open: 'openRewards', cash: 1e6, races: 22, tab: 0 },
  // Пасс снимается с ЗАБРАННЫМИ задачами: на нулевой шкале все 35 строк
  // одинаково серые, и ни граница «докуда дошёл», ни активная кнопка не видны.
  rewardsPass: { open: 'openRewards', cash: 1e6, races: 22, tab: 1, claimTasks: true },
  rewardsDaily: { open: 'openRewards', cash: 1e6, races: 22, tab: 2 },
  rewardsMail: { open: 'openRewards', cash: 1e6, races: 22, tab: 3 },
  // Магазин — четыре вида в одном окне, как и награды: снимаем каждый, потому
  // что наложения видны только на своей вкладке. Кадра оригинала нет ни для
  // одного из них (вкладки 6 нет на всех 42), сверять не с чем — только `shot`.
  shop: { open: 'openShop', cash: 1e6, tab: 0 },
  shopCash: { open: 'openShop', cash: 1e6, races: 6, tab: 1 },
  shopGems: { open: 'openShop', cash: 1e6, tab: 2 },
  shopPasses: { open: 'openShop', cash: 1e6, tab: 3 },
  // Шаги 6-9. Кадра оригинала нет ни у одного из этих экранов (вкладки 2, 4-6,
  // гараж, арена, клубы и коллекции не показаны ни на одном из 42), поэтому они
  // снимаются только для `shot` — проверить наложения и обрезку маской.
  // `draw` набивает инвентарь: на пустых слотах не видно ни имён предметов, ни
  // ценников апгрейда, то есть ровно того, что и наезжает друг на друга.
  gear: { open: 'openGear', cash: 1e6, races: 30, draw: 20, tab: 0 },
  gearPacks: { open: 'openGear', cash: 1e6, draw: 4, tab: 1 },
  gearBag: { open: 'openGear', cash: 1e6, draw: 24, tab: 2 },
  garage: { open: 'openGarage', cash: 1e9, tab: 0 },
  garageParts: { open: 'openGarage', cash: 1e9, drawParts: 16, tab: 1 },
  garagePaint: { open: 'openGarage', cash: 1e9, tab: 2 },
  // Арена и клуб — состояние «уже играл»: на нуле нет ни истории, ни таблицы.
  arena: { open: 'openLeagues', cash: 1e6, races: 14, arena: 2, tab: 1 },
  tourney: { open: 'openLeagues', cash: 1e6, races: 40, register: true, tab: 2 },
  cup: { open: 'openLeagues', cash: 1e6, races: 40, register: true, tab: 3 },
  club: { open: 'openLeagues', cash: 1e6, races: 14, club: true, tab: 4 },
  // Первый альбом добит целиком, а Wild Cards выданы: иначе на кадре нет ни
  // кнопки `Claim`, ни подписи `USE WILD` — то есть ровно тех двух состояний,
  // которые и могут наложиться на соседей.
  rewardsAlbums: { open: 'openRewards', cash: 1e6, races: 22, cards: true, wild: 2, album: 0, tab: 4 },
  shopLucky: { open: 'openShop', cash: 1e6, tab: 4 },
  shopCodes: { open: 'openShop', cash: 1e6, tab: 5 },
  careerOutfits: { open: 'openCareer', cash: 1e6, outfits: 3, tab: 1 },
  careerAvatars: { open: 'openCareer', cash: 1e6, races: 22, tab: 2 },
  // Полоса Unique Cores есть только у Unique-драйвера, а в гаче он 0.5% —
  // ждать его выпадения кадром нельзя, поэтому выдаём прямо.
  driversCores: { open: 'openDrivers', cash: 1e6, unique: true, tab: 0 },
  parallel: { open: null, cash: 30e6, unlock: 3, fans: 4e6 },
  parallelClasses: { open: 'openClasses', cash: 30e6, unlock: 3, fans: 4e6 },
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
    // Обучение перекрывает СВОЕЙ карточкой любой экран, и ворота вкладок
    // прячут половину меню. Для всех кадров, кроме кадров самого обучения, оно
    // пройдено: иначе каждый второй скриншот — это скриншот туториала.
    if (c.tutorial) {
      main.state.tutorial.done = false
      main.state.tutorial.step = c.tutorial - 1
    } else {
      main.state.tutorial.finish()
      main.state.tutorial.navUnlocked = true
      // Разовая справка «что это за экран» показывается поверх окна при первом
      // входе — а стенд входит в каждое окно первый раз всегда. Без этой
      // отметки кадром любой вкладки был бы кадр справки.
      if (!c.intro) main.state.tutorial.seen.__all = true
    }
    main.tutorial.sync()
    // Пустой экран не показывает ни одной активной кнопки, а проверять надо
    // живое состояние — поэтому ресурсы выдаём щедро.
    main.state.gainCareerXp(9000)
    main.state.gems = 500
    if (c.cash) main.state.addCash(c.cash)
    // Открытые классы копят фанатов и платят, даже когда игрок в них не едет
    // (ECONOMY.idleClassShare) — без фанатов строка параллельного дохода
    // показала бы пол $1/с и наложения бы не поймала.
    if (c.unlock) {
      const ids = Object.keys(main.state.classes).slice(0, c.unlock)
      for (const id of ids) {
        main.state.unlockClass(id)
        main.state.classes[id].fans = c.fans || 0
      }
      main.state.invalidateIdle()
      main.state.activeClass = ids[c.unlock - 1]
    }
    // Прокатываем заезды тем же кодом, что игра: место берём из настоящей
    // симуляции, места соперников — из неё же, иначе таблица покажет расклад,
    // которого в игре не бывает.
    for (let i = 0; i < (c.races || 0); i++) {
      const race = main.race
      while (!race.sim.finished) race.sim.step(1)
      race.finish()
      race.start()
    }
    // Попап последнего заезда живёт 2.6 с и на кадре лёг бы поверх окна —
    // в игре его при открытой модалке не показывают вовсе.
    // Гасить одним setAlpha мало: твин появления запущен в этом же кадре и на
    // следующем вернёт альфу обратно в 1.
    main.tweens.killTweensOf(main.finish)
    main.finish.setAlpha(0)
    // Тосты живут 1.7 с на глубине 150 — выше модалок, и на кадре ложились
    // поперёк содержимого вкладки. В игре так и задумано (это единственный
    // отклик на действие внутри окна), но сверять композицию через них нельзя.
    main.toasts.removeAll(true)
    if (c.claimTasks) main.state.claimAllTaskRewards()
    // Состояние новых осей. Выдаём предметы ТЕМ ЖЕ кодом, что игра (паки и
    // автоэкипировка), а не расставляя их руками: кадр должен показывать то,
    // что игрок и увидит, включая редкости, уровни и то, что влезло в слоты.
    if (c.draw) {
      main.state.gems += 2000
      main.state.gear.draw('standard', c.draw)
      main.state.autoGear()
    }
    if (c.drawParts) {
      main.state.gems += 2000
      main.state.parts.draw('parts', c.drawParts)
      main.state.autoGarage()
    }
    if (c.arena) { for (let i = 0; i < c.arena; i++) main.state.playArena(0) }
    if (c.register) { for (const k of ['league', 'weekly', 'cup']) main.state.registerBracketFor(k) }
    if (c.club) { main.state.joinClub(0); main.state.startClash(); main.state.capturePosition(0) }
    if (c.cards) {
      main.state.collection.packs = 4
      for (let i = 0; i < 4; i++) main.state.openCollectionPack()
    }
    if (c.outfits) {
      for (let i = 0; i < c.outfits; i++) main.state.grant({ kind: 'outfit' })
    }
    if (c.wild) main.state.collection.wild = c.wild
    if (c.album != null) {
      const col = main.state.collection
      for (let i = 0; i < 9; i++) col.cards[`${c.album}:${i}`] = 1
    }
    if (c.unique) {
      main.state.roster.create('unique')
      for (let i = 0; i < 3; i++) main.state.roster.create('pro')
      main.state.grant({ kind: 'cores', amount: 6 })
    }
    // Полный refreshUI, а не тот частичный, что идёт каждые 200 мс из update:
    // замки вкладок и строка цели пересчитываются только в нём, и без этого
    // вызова кадр показывает состояние ДО всех настроек выше.
    main.refreshUI()
    if (c.open) main[c.open]()
    if (c.tab != null) main.modal?.setTab?.(c.tab)
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
