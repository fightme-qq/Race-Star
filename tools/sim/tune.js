import './headless.js'
import { fastSim } from './fastsim.js'
import { cheapestFirst, resetPolicyCache } from './policies.js'
import { switchRoi, switchAsap } from './classplan.js'
import { withoutShop, withoutGacha, withoutGear, withoutGarage, withoutLucky } from './sinks.js'
import { milestoneTargets, unlockSec, scoreRun } from './targets.js'
import { ECONOMY, LEAGUES, SEASON } from '../../src/config/balance.js'
import { SHOP } from '../../src/config/shop.js'
import { GEAR } from '../../src/config/gear.js'
import { GARAGE } from '../../src/config/garage.js'
import { RACE_CLASSES } from '../../src/config/classes.js'
import { SeededRandom } from '../../src/utils/rng.js'

// Конфиги — обычные объекты, правим на месте перед прогоном.
//
// Пространство перебора сузилось на шаге 2, и это главное, что с ним произошло.
// Прибавки экономической ветки (6+3L, 0+9L, 0+15L, 10+5L) и цены двух её слотов
// теперь СНЯТЫ с кадров [F] — крутить их нельзя, иначе шаг 2 отменяет сам себя.
// Ушли: ecoGain, ecoPg, fanGain, fansK (доход = фанаты / 1188 [~]).
// Остались свободными только те четыре числа, которых в кадрах нет вовсе.
export function applyTune(p) {
  resetPolicyCache()
  ECONOMY.leaguePrizeMult = p.leaguePrizeMult
  ECONOMY.prizeSeconds = p.prizeSeconds
  ECONOMY.classFanMult = p.classFanMult
  ECONOMY.idleClassShare = p.idleClassShare
  SEASON.promoteRatio = p.promoteRatio
  SHOP.cashRateMult = p.cashRateMult
  // Шаги 6-7: два общих множителя вклада новых осей силы. Это ровно те
  // координаты, из-за которых переподгонка здесь обязательна — гир и гараж
  // складываются с составом ДО процентов апгрейдов, то есть усиливают и их.
  GEAR.statMult = p.gearStat
  GARAGE.statMult = p.garageStat
  // Первая ступень 190 — ROOKIE снята с кадров [F], дальше геометрия [X].
  LEAGUES.forEach((l, i) => { l.power = Math.round(190 * Math.pow(p.leagueStep, i)) })
  for (const cls of RACE_CLASSES) {
    for (const u of cls.upgrades) {
      // Цена держится за наблюдённый якорь (Parking Lv.8 $4.86K, Grandstands
      // Lv.5 $9.05K), поэтому двигать можно только наклон.
      if (u.key === 'e1') u.pg = p.parkPg
      if (u.key === 'e2') u.pg = p.fanPg
    }
  }
}

// Насколько просчитанный план перехода обязан обгонять наивный «переходи, как
// только хватило». Это НЕ метрика игрока, а требование к дизайну, и до шага
// «параллельный доход» его в счёте не было — из-за чего шаг 2 полгода прожил
// на точке, где cheapestFirst и roiGreedy давали одно и то же.
// Замер прямо показал, зачем это здесь: при idleClassShare = 1 (полный
// параллельный доход) обе стратегии сходятся в точку — $3.23T против $3.23T, —
// потому что переход перестаёт что-либо стоить. Счёт по вехам этого не видит
// вовсе: вехи-то как раз выполняются идеально.
const DECISION_GAP = 1.25

// Шаг 5 добавил магазину гемовый сток, и у него есть свой способ сломаться,
// которого счёт по вехам не видит вовсе. Гемы — общий кошелёк двух трат: паки
// «деньги за гемы» и гача. Если курс щедрый, весь приток уходит в магазин и
// ВТОРАЯ ОСЬ СИЛЫ умирает; если скупой — вкладка декорация. Оба исхода дают
// приличные вехи, потому что деньги в игре всё равно появляются.
//
// ПЕРЕСОБРАНО. Сдавалось это требованием на ДОЛЮ гемов (`SHOP_SHARE` = 12-45%),
// и доля оказалась не той величиной — по двум причинам сразу.
// Во-первых, бот не выбирает долю: он тратит в порядке вызова, и доля выходит
// из дневных лимитов, а не из курса. При cashRateMult 1.0 и 0.85 она одна и та
// же (57%), то есть штраф был вне досягаемости единственной координаты
// магазина, и перебор честно сходился, ничего не исправив.
// Во-вторых, сама доля ничего не гарантирует. Прямой замер при курсе 1.0:
// «только гача» $25.8B против $23.3B у смешанной игры — доля 51%, а магазин
// при этом ОТНИМАЛ. Требование выполнялось бы на конфиге, где вкладка вредна.
//
// Теперь проверяется то же, что у политик закупки и планов перехода: НУЖНЫ ЛИ
// ОБЕ ТРАТЫ. Ни один сток в одиночку не должен обыгрывать смешанную игру, и с
// запасом — иначе точка стоит на грани, где второй сток уже декорация.
const SINK_GAP = 1.10

// Стоков стало ПЯТЬ: денежные паки магазина, гача драйверов, паки гира, части
// машины и Lucky Draw. Требование то же — ни один в одиночку не обыгрывает
// смешанную игру, — но цена проверки выросла впятеро, поэтому она считается на
// укороченном горизонте. Это законно: требование к ДИЗАЙНУ (нужна ли трата) не
// зависит от длины прогона, в отличие от вех, которые мерятся только на 700ч.
const SINK_HOURS = 300
const SINKS = [
  ['shop', withoutShop], ['gacha', withoutGacha],
  ['gear', withoutGear], ['garage', withoutGarage], ['lucky', withoutLucky],
]

export function sinkGaps(seed = 1, hours = SINK_HOURS) {
  const mixed = fastSim({ hours, policy: cheapestFirst, seed, classPlan: switchRoi }).earned
  return SINKS.map(([name, fn]) => {
    const without = fn(() => fastSim({
      hours, policy: cheapestFirst, seed, classPlan: switchRoi,
    }).earned)
    return { name, gap: mixed / Math.max(1, without), mixed, without }
  })
}

function sinkPenalty(seed) {
  let pen = 0
  for (const { gap } of sinkGaps(seed)) {
    if (gap < SINK_GAP) pen += 0.8 * Math.pow(Math.log(gap / SINK_GAP), 2)
  }
  return pen
}

export function evaluate(p, { hours = 700, seeds = [1, 2] } = {}) {
  applyTune(p)
  let score = 0
  let last = null
  for (const seed of seeds) {
    // Класс ведёт switchRoi: прогон одним классом не платит ни одной цены
    // разблокировки, а все пять вех — это ровно они. Подбор на нём мерил бы
    // «за сколько накопит», а не «за сколько дойдёт».
    last = fastSim({ hours, policy: cheapestFirst, seed, classPlan: switchRoi })
    score += scoreRun(last)
    // Замер стоков — только на первом сиде: он стоит двух лишних прогонов, а
    // мерит требование к ДИЗАЙНУ, которое от сида не зависит.
    if (seed === seeds[0]) score += sinkPenalty(seed)
    const naive = fastSim({ hours, policy: cheapestFirst, seed, classPlan: switchAsap })
    const gap = last.earned / Math.max(1, naive.earned)
    if (gap < DECISION_GAP) score += 0.8 * Math.pow(Math.log(gap / DECISION_GAP), 2)
  }
  return { score: score / seeds.length, run: last }
}

const SPACE = {
  // Наклон цены двух слотов, у которых базы в кадрах нет. Нижняя граница 1.20
  // не декоративная: при более пологой цене плоская прибавка обгоняет её и
  // покупка становится бесплатной. Верхняя — наблюдённые наклоны денежных
  // слотов (1.431 и 1.646) с запасом.
  // Верхние границы подняты после второго прогона шага 2: обе цены встали на
  // потолок (2.4989 при 2.60 и 2.5443 при 3.00) — то есть подбор хотел дальше,
  // а граница держала молча. Крутая цена здесь означает «дёшево до якоря,
  // дорого после»: якорь снят с кадра и не двигается, двигается только наклон.
  parkPg:     [1.20, 4.50],
  fanPg:      [1.20, 4.50],
  // Лига умножает ПРИЗОВЫЕ (см. ECONOMY). Нижняя граница 1.45 — не запас «на
  // всякий случай», а требование к дизайну. Повышение у нас автоматическое,
  // отказаться нельзя, и при слабом множителе оно становится НАКАЗАНИЕМ:
  // соперники сильнее, средний бонус за место падает примерно в 1.6 раза, а
  // взамен ничего. Первый прогон шага 2 ровно это и выбрал — прижал множитель
  // к нижней границе 1.05. Счёт не возражал: цель по лиге выполняется сама
  // собой, потому что лестницу проходят не по желанию.
  leaguePrizeMult: [1.45, 3.00],
  // classFanMult ВЕРНУЛСЯ в перебор на шаге «параллельный доход». Прошлый
  // довод против («подбирать c против вех, выведенных из c, значит подгонять
  // число под самого себя») снят тем, что вехи теперь и правда выводятся из c
  // на каждом прогоне — milestoneTargets() пересчитывает лесенку по r = 5/√c.
  // Самоподгонка при этом невозможна: штраф «не открыл класс вовсе» (ln(12)^2)
  // не самосогласован, маленькое c его не обходит.
  // Нижняя граница — прежнее значение 1.5625: замер показал, что при нём
  // шестой класс не берётся ни при какой доле пассивного дохода.
  classFanMult:  [1.5625, 3.20],
  // Доля дохода покинутого класса. Обе границы содержательны и обе поставлены
  // замером: при 0 это прежняя, последовательная игра, где шестой класс
  // недостижим; при 1 переход бесплатен и решение «когда» вырождается
  // (switchRoi и switchAsap дают одинаковые $3.23T). Ответ где-то между.
  idleClassShare: [0.15, 1.00],
  leagueStep:    [1.20, 1.90],
  promoteRatio:  [0.6, 2.6],   // счёт сезона для повышения = races * ratio
  prizeSeconds:  [4, 300],     // приз за 1-е место в секундах дохода
  // Курс паков «деньги за гемы» (config/shop.js). Границы широкие нарочно:
  // это первое число магазина, и до прогона неизвестно даже, какого оно порядка.
  cashRateMult:  [0.05, 20],
  // Вклад гира и гаража. Границы широкие: это первые числа двух новых осей, и
  // до прогона неизвестно даже, какого они порядка. Нижняя не нулевая нарочно —
  // ноль означал бы «вкладки нет», а её наличие проверяется штрафом стоков, а
  // не границей.
  gearStat:      [0.15, 5.0],
  garageStat:    [0.15, 5.0],
}

// Найденные предыдущими прогонами точки — чтобы расширение пространства
// поиска не теряло уже достигнутый результат.
//
// Точки этапов 1–4 отсюда УДАЛЕНЫ, и это не потеря: они задавали ecoGain /
// ecoPg / fanGain / fansK, а этих координат больше нет — экономика шага 2
// стоит на снятых числах. Переносить старую точку было бы нечего.
const SEED_POINTS = [
  // Ручная прикидка под новую экономику: лига как главный множитель притока,
  // цена ветки фанатов по наблюдённому наклону денежных слотов.
  { parkPg: 1.431, fanPg: 1.431, leaguePrizeMult: 1.45,
    leagueStep: 1.4183, promoteRatio: 1.9653, prizeSeconds: 30 },
  { parkPg: 1.500, fanPg: 1.330, leaguePrizeMult: 1.60,
    leagueStep: 1.4183, promoteRatio: 1.7200, prizeSeconds: 60 },
  // Точка первого прогона шага 2 (счёт 0.802, лига тогда сидела на фанатах и
  // была прижата к 1.05) — ориентир по вехам, но с наградой за повышение.
  { parkPg: 1.745, fanPg: 1.900, leaguePrizeMult: 1.45,
    leagueStep: 1.4795, promoteRatio: 1.5505, prizeSeconds: 114.6 },
  // Третий прогон, счёт 1.243 — первая точка, где повышение в лиге выгодно.
  { parkPg: 2.4989, fanPg: 2.5443, leaguePrizeMult: 1.4500,
    leagueStep: 1.4898, promoteRatio: 1.9631, prizeSeconds: 5.6948 },
  // Шаг 3a, счёт 4.012 против 7.313 у действующей точки — и всё же В КОНФИГ ОНА
  // НЕ ВЗЯТА. Счёт она улучшает единственным способом: роняет leagueStep до
  // 1.348, игрок доезжает до 13-й лиги из 14, множитель призовых 1.96^13 даёт
  // x3400, заработок раздувается с $196B до $44T, и шестой класс открывается
  // на 7.4-м дне при цели 26. То есть штраф за «не дошёл» (ln(12)^2 = 6.17)
  // перевешивает разгон лиг, и оптимизатор честно меняет дизайн на счёт.
  // Держим здесь как отрицательный результат: конфликт не в коэффициентах.
  // Со счётом точек шагов 1-4 не сравнивать — с шага 3a вехи считаются по
  // факту открытия класса, а не по накоплению на его цену.
  // { parkPg: 4.2885, fanPg: 2.4447, leaguePrizeMult: 1.9573,
  //   leagueStep: 1.3480, promoteRatio: 1.9242, prizeSeconds: 4.7896 },
  // Шаг «параллельный доход»: точка с ручного замера долей и множителя — при
  // ней шестой класс и берётся, и остаётся решением ($755B у просчитанного
  // против $576B у наивного). Остальные координаты — от действующего конфига.
  { parkPg: 2.4989, fanPg: 2.5443, leaguePrizeMult: 1.4500,
    leagueStep: 1.4898, promoteRatio: 1.9631, prizeSeconds: 5.6948,
    classFanMult: 2.0, idleClassShare: 0.5 },
  // Действующая точка шага 4 (счёт 0.876 ДО магазина). Держим здесь, чтобы
  // новая координата курса не потеряла уже найденное по остальным семи.
  { parkPg: 2.3068, fanPg: 2.0555, leaguePrizeMult: 1.4500,
    leagueStep: 1.4898, promoteRatio: 1.8122, prizeSeconds: 5.85,
    classFanMult: 2.0, idleClassShare: 0.5, cashRateMult: 1.0 },
  // Точка первого прогона шага 5 (счёт 1.307 по прежнему требованию на ДОЛЮ
  // гемов) с курсом, снятым ручным замером стоков: при 1.0 магазин отнимает
  // ($23.3B против $25.8B без него), при 8.0 гача становится декорацией
  // ($61.4B против $69.2B без неё), смешанная игра выигрывает у обеих около 3.
  { parkPg: 2.3068, fanPg: 1.8975, leaguePrizeMult: 1.4500,
    leagueStep: 1.4124, promoteRatio: 1.7181, prizeSeconds: 4.985,
    classFanMult: 1.8961, idleClassShare: 0.5, cashRateMult: 3.0 },
  // Действующая точка перед шагами 6-9 плюс единичный вклад новых осей: держим,
  // чтобы перебор не потерял уже найденное по остальным восьми координатам.
  { parkPg: 2.3068, fanPg: 1.8975, leaguePrizeMult: 1.4500,
    leagueStep: 1.4124, promoteRatio: 1.7181, prizeSeconds: 4.985,
    classFanMult: 1.8961, idleClassShare: 0.5, cashRateMult: 3.0,
    gearStat: 1.0, garageStat: 1.0 },
]

// Точки прежних шагов не знают двух новых координат, а applyTune пишет их в
// ECONOMY как есть — undefined превратил бы весь прогон в NaN молча.
const DEFAULTS = {
  classFanMult: 1.5625, idleClassShare: 0.5, cashRateMult: 1.0,
  gearStat: 1.0, garageStat: 1.0,
}
const full = (p) => ({ ...DEFAULTS, ...p })

const sampleLog = (rng, [lo, hi]) => Math.exp(rng.float(Math.log(lo), Math.log(hi)))

// Случайный поиск в логарифмическом пространстве + покоординатный спуск.
export function search({ iters = 100, refine = 2, hours = 700 } = {}) {
  const rng = new SeededRandom(20260902)
  let best = null

  for (const seed of SEED_POINTS) {
    const p = full(seed)
    const { score } = evaluate(p, { hours, seeds: [1] })
    if (!best || score < best.score) best = { score, p }
  }

  for (let i = 0; i < iters; i++) {
    const p = Object.fromEntries(Object.entries(SPACE).map(([k, r]) => [k, sampleLog(rng, r)]))
    const { score } = evaluate(p, { hours, seeds: [1] })
    if (!best || score < best.score) { best = { score, p }; process.stderr.write(`  ${i}: ${score.toFixed(2)}\n`) }
  }

  // Покоординатный спуск обязан держаться внутри SPACE. Без clamp он уводил
  // fanPg на 1.52 при границе 1.32 — то есть ровно в ту «ловушку», от которой
  // граница и поставлена: цена ветки фанатов x1.5 за уровень при +0.7 фаната.
  const clamp = (key, v) => Math.min(SPACE[key][1], Math.max(SPACE[key][0], v))

  for (let pass = 0; pass < refine; pass++) {
    const step = 0.16 / (pass + 1)
    for (const key of Object.keys(SPACE)) {
      for (const dir of [-1, 1]) {
        const p = { ...best.p, [key]: clamp(key, best.p[key] * Math.exp(dir * step)) }
        const { score } = evaluate(p, { hours, seeds: [1, 2] })
        if (score < best.score) { best = { score, p }; process.stderr.write(`  ${key}${dir > 0 ? '+' : '-'}: ${score.toFixed(2)}\n`) }
      }
    }
  }
  return best
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const best = search({ iters: Number(process.argv[2] || 200) })
  console.log('\nлучший счёт', best.score.toFixed(3))
  for (const [k, v] of Object.entries(best.p)) console.log(`  ${k}: ${v.toFixed(4)}`)

  const { run } = evaluate(best.p, { hours: 700, seeds: [1] })
  console.log('\n  веха     цель    открыт')
  for (const t of milestoneTargets()) {
    const a = unlockSec(run, t.price)
    console.log(`  ${String(t.price).padStart(11)}  ${t.label.padStart(6)}  ` +
      (a ? (a / 3600).toFixed(1) + 'ч' : 'не дошёл'))
  }
  const levels = Object.values(run.state.classes)
    .reduce((a, c) => a + Object.values(c.levels).reduce((x, y) => x + y, 0), 0)
  console.log(`\n  уровней ${levels} | побед ${(100 * run.places[1] / run.races).toFixed(1)}% ` +
    `| класс ${run.state.clsDef.index} | лига ${run.state.cls.league}` +
    ` | приток фанатов x${(run.state.agg.fansPerRace / 10).toFixed(1)}`)
  console.log('  лиги:', LEAGUES.map((l) => l.power).join(' '))
}
