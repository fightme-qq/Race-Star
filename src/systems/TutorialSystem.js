import { STEPS, OBJECTIVES } from '../config/tutorial.js'

export const freshTutorial = () => ({
  step: 0,          // индекс в STEPS
  done: false,
  navUnlocked: false, // стенд и повторное прохождение: снимает ворота вкладок
  seen: {},         // разовые отметки («игрок открывал драйверов»)
})

// Автомат обучения. Держит ровно две вещи: на каком шаге игрок и какая цель у
// него сейчас. Всё остальное (подсветка, текст, кнопки) — дело UI.
//
// Шаги хранятся ИНДЕКСОМ, а не id: сценарий разовый и переживать его правку
// между версиями не нужно — сейв всё равно ломается на VERSION. Зато `seen`
// хранится ключами, потому что его переживать нужно: отметка «открывал
// драйверов» закрывает цель, и потеряться она не должна.
export class Tutorial {
  constructor(state, saved) {
    this.state = state
    Object.assign(this, freshTutorial(), saved || {})
  }

  toJSON() {
    return { step: this.step, done: this.done, navUnlocked: this.navUnlocked, seen: this.seen }
  }

  // Текущий шаг с пропуском тех, чьё условие не выполнено.
  get current() {
    if (this.done) return null
    while (this.step < STEPS.length) {
      const s = STEPS[this.step]
      if (!s.need || s.need(this.state)) return s
      this.step++
    }
    this.done = true
    return null
  }

  advance() {
    if (this.done) return null
    this.step++
    return this.current
  }

  finish() { this.done = true; this.step = STEPS.length }

  markSeen(key) {
    if (this.seen[key]) return false
    this.seen[key] = true
    return true
  }

  // Разовая справка при первом входе в экран. `__all` — отметка стенда: кадры
  // всех вкладок снимаются через те же open*, и без неё каждый второй
  // скриншот был бы скриншотом справки поверх экрана.
  introSeen(key) { return !!(this.seen.__all || this.seen['intro:' + key]) }

  markIntro(key) {
    if (this.introSeen(key)) return false
    this.seen['intro:' + key] = true
    return true
  }

  // Ставка на первый апгрейд. Шаг, который ЖДЁТ действия, обязан быть выполним
  // в тот момент, когда его показывают: на чистом старте кошелёк $0 при доходе
  // $1/с, а первый слот стоит $25 — обучение просило нажать кнопку, которая 25
  // секунд оставалась серой, и выглядело сломанным.
  //
  // Считается ОТ ЦЕНЫ, а не константой: цена слота живёт в classes.js и уже
  // менялась дважды. Выдаём разницу, а не сумму — игроку, дошедшему до шага с
  // деньгами (перепрохождение, второй класс), не достаётся ничего лишнего.
  //
  // На баланс это не влияет: разовые $25 против $15.6B последней вехи. Стенд
  // обучения не проходит вовсе, так что прогон остаётся тем же.
  stake() {
    const step = this.current
    if (!step || step.await !== 'buy' || this.seen.stake) return 0
    const s = this.state
    const key = s.clsDef.upgrades[0]?.key
    if (!key) return 0
    this.seen.stake = true
    const need = Math.ceil(s.priceOf(key) - s.cash)
    if (need <= 0) return 0
    s.addCash(need)
    return need
  }

  // Действие игрока. Шаг, который ЖДЁТ этого действия, закрывается сам —
  // отдельного «Next» под ним нет: игрок уже сделал то, о чём шаг просил, и
  // просить подтвердить это второй раз некуда.
  onAction(action) {
    const step = this.current
    if (!step || step.await !== action) return false
    this.advance()
    return true
  }

  // Первая невыполненная цель. `endless` считается невыполнимой по построению
  // (now всегда 0 < at) — это и нужно: она замыкает список и остаётся навсегда.
  get objective() {
    const s = this.state
    for (const o of OBJECTIVES) {
      const now = o.now(s)
      if (now >= o.at && !o.endless) continue
      if (o.endless) {
        // Текст хвоста считается на месте: «следующая лига» — это не константа,
        // а та ступень, на которую игрок лезет прямо сейчас.
        const next = s.nextLeagueOf(s.activeClass)
        return next
          ? { id: o.id, text: `Climb to ${next.name}`, now: s.cls.seasonScore, at: null }
          : { id: o.id, text: 'Top league reached — keep earning', now: 0, at: null }
      }
      return { id: o.id, text: o.text, now, at: o.at }
    }
    return null
  }
}
