// [X] Обучение и ворота вкладок. В оригинале онбординга нет ни на одном из 42
// кадров — но там его и не видно: кадры сняты с прокачанного аккаунта. Здесь
// всё наше.
//
// Почему это не «приятное дополнение», а починка: на чистом старте экран
// показывает 1M/$1/500💎/P2-10/Lv.27/«0% → 2%» и ШЕСТЬ вкладок сразу, четыре с
// красными точками. Ни одно число на экране не объясняет себя, а первое
// действие игрока («купить апгрейд») ничем не выделено среди двадцати пяти
// доступных экранов.
//
// Отсюда два разных лекарства, и их нельзя путать:
//   1. STEPS — разовое обучение первым минутам, ведёт за руку по одному шагу.
//   2. OBJECTIVES — постоянная строка «что делать сейчас», живёт всю игру.
// Первое кончается через минуту, второе не кончается никогда — и именно оно
// отвечает на «непонятно, что делать» на сотом часу, когда туториал забыт.

// --- Ворота вкладок ------------------------------------------------------
// Вкладки открываются по ПРОБЕГУ КЛАССА, а не по деньгам: пробег растёт сам
// (гонка идёт непрерывно), то есть ворота гарантированно откроются и не могут
// запереть игрока навсегда. Порядок — по тому, насколько вкладка нужна: сперва
// драйверы (вторая ось силы), последним гараж с гиром (четвёртая).
//
// index — позиция в BottomNav.TABS.
export const TAB_GATES = {
  1: { races: 12, label: 'Gear' },      // 🎒 — нужны предметы, а они с 12-й гонки
  2: { races: 1,  label: 'Drivers' },   // 🃏
  3: { races: 3,  label: 'Leagues' },   // 🏆
  4: { races: 5,  label: 'Rewards' },   // 🏅
  5: { races: 8,  label: 'Shop' },      // 🛒
}

export const tabUnlocked = (state, index) => {
  const gate = TAB_GATES[index]
  if (!gate) return true
  return state.tutorial.navUnlocked || state.cls.races >= gate.races
}

// --- Шаги обучения -------------------------------------------------------
// `await` — шаг ждёт ДЕЙСТВИЯ игрока, а не нажатия «Next». Таких ровно два:
// покупка апгрейда и открытие вкладки лиг. Читать про кнопку и нажать кнопку —
// разные вещи, но ждать действия на каждом шаге значит превратить обучение в
// допрос, поэтому остальные листаются.
//
// `need` — шаг пропускается, если условие ложно. Нужно воротам: рассказывать
// про вкладку лиг, пока она закрыта, нельзя.
export const STEPS = [
  {
    id: 'welcome',
    title: 'Your team races non-stop',
    body: 'You never drive. You build the fastest team and spend what it earns.',
    target: null,
  },
  {
    id: 'race',
    title: 'One race, 60 seconds',
    body: 'It restarts by itself, forever. Where you finish decides the cash and the fans you get.',
    target: 'raceHead',
  },
  {
    id: 'stats',
    title: 'Two ways to win',
    body: 'ATTACK is overtaking, DEFEND is holding position. The race rolls one of them at the start — so both stats matter.',
    target: 'raceStats',
  },
  {
    id: 'buy',
    title: 'Make the team faster',
    body: 'Upgrades are the whole game. Buy one — cash ticks up every second, so you never wait long.',
    target: 'firstCard',
    await: 'buy',
    hint: 'Tap Upgrade',
  },
  {
    id: 'income',
    title: 'It earns while you are away',
    body: 'That number is cash per second. It keeps running with the app closed — you collect it on return.',
    target: 'income',
  },
  {
    id: 'goal',
    title: 'Always one goal',
    body: 'This line tells you what to do next, all game long. Finish it and the next one appears.',
    target: 'objective',
  },
]

// --- Первый вход в экран -------------------------------------------------
// Обучение кончается на первой минуте, а вкладки открываются на первом часу —
// и каждая вываливает четыре подвкладки, гачу и мешок предметов без единого
// слова о том, зачем это. Один разовый экран-объяснение на вкладку, дальше
// молчим. Показывается тем же окном, что справка по ⓘ: заводить второй вид
// всплывающего окна ради шести абзацев значило бы держать два макета
// синхронно.
export const SCREEN_INTRO = {
  gear: {
    title: 'Gear', icon: '🎒', badge: 'THIRD POWER AXIS',
    body: 'Items your drivers wear. Each slot adds raw Attack or Defense on top of the driver stats.',
    note: 'Slots open as the class racks up races. Duplicates merge into stronger items instead of piling up. Cars live here too — same items, different owner.',
  },
  drivers: {
    title: 'Drivers', icon: '🃏', badge: 'SECOND POWER AXIS',
    body: 'Your squad is the team. Team power is the sum of the drivers you put in the starting slots, and it decides every race.',
    note: 'Packs cost gems. Spare drivers are not junk: feed them for training XP or merge duplicates into stars. Auto-fill picks the best squad for you.',
  },
  leagues: {
    title: 'Leagues', icon: '🏆', badge: 'WHERE THE MONEY IS',
    body: 'The ladder. Every league up multiplies your race prize — this is the biggest income multiplier in the game.',
    note: 'You score points every race; enough points over a season promotes you. The nine rivals in the table are the same nine you just raced.',
  },
  rewards: {
    title: 'Rewards', icon: '🏅', badge: 'FREE INCOME',
    body: 'Tasks, season pass, daily login and mail. Tasks complete themselves as you play — you only have to claim.',
    note: 'Task tokens fill the season pass. This is where most of your gems come from, and gems buy drivers and gear.',
  },
  shop: {
    title: 'Shop', icon: '🛒', badge: 'SPEND GEMS',
    body: 'Cash packs, gem packs and passes. Cash packs are priced in seconds of your current income, so they never go stale.',
    note: 'Gems have two homes: packs here and pulls in Drivers/Gear. Neither is strictly better — split them.',
  },
  career: {
    title: 'Career Driver', icon: '👤', badge: 'YOU, ON THE TRACK',
    body: 'You race as a sixth driver. Career XP comes from races in this class and buys skill points.',
    note: 'There are more nodes than points — you cannot take everything. Half the nodes trade one stat for another, so the tree is a real choice.',
  },
  classes: {
    title: 'Classes', icon: '🏁', badge: 'SIX PARALLEL TEAMS',
    body: 'Six racing classes, each with its own team, league, upgrades and fans. You unlock them with cash.',
    note: 'A class you leave keeps earning at a reduced rate — unlocking is not a reset. Late game most of your income comes from classes you no longer race.',
  },
}

// --- Постоянные цели -----------------------------------------------------
// Первая невыполненная показывается в строке над сеткой. Порядок — маршрут
// игрока по игре: каждая цель ведёт к тому, что откроется следующим.
//
// `at` — сколько нужно, `now` — сколько есть. Строка показывает и то, и другое:
// «3/5» отвечает на «сколько ещё», а без этого цель — просто лозунг.
export const OBJECTIVES = [
  {
    id: 'first-upgrade',
    text: 'Buy your first upgrade',
    at: 1,
    now: (s) => Object.values(s.cls.levels).reduce((a, b) => a + b, 0),
  },
  {
    id: 'first-races',
    text: 'Finish 3 races',
    at: 3,
    now: (s) => s.cls.races,
  },
  {
    id: 'drivers',
    text: 'Open Drivers and fill your squad',
    at: 1,
    now: (s) => (s.tutorial.seen.drivers ? 1 : 0),
  },
  {
    id: 'first-win',
    text: 'Win a race',
    at: 1,
    now: (s) => s.cls.seasonWins + (s.cls.history?.reduce((a, h) => a + (h.wins || 0), 0) || 0),
  },
  {
    id: 'league-2',
    text: 'Reach the second league',
    at: 1,
    now: (s) => s.cls.league,
  },
  {
    id: 'upgrades-10',
    text: 'Reach 10 upgrade levels',
    at: 10,
    now: (s) => Object.values(s.cls.levels).reduce((a, b) => a + b, 0),
  },
  {
    id: 'second-class',
    text: 'Unlock a second class',
    at: 2,
    now: (s) => s.unlockedCount,
  },
  // Хвост: цель, которая не кончается. Без неё строка исчезает у игрока,
  // прошедшего все вехи, — то есть ровно у того, кто дальше играет дольше всех.
  {
    id: 'climb',
    text: 'Climb to the next league',
    at: 1,
    now: () => 0,
    endless: true,
  },
]
