import { held, PAIR, COL } from './Formation.js'

// Борьба: что машина делает, когда рядом соперник. Отвечает на один вопрос —
// какое поперечное смещение (laneT) машина хочет в этом кадре — и попутно
// выставляет уровни эффектов (attack / defend / draft), по которым CarPainter
// рисует стрелки, щит и тягу.
//
// Ни одно состояние здесь не проигрывается по таймеру: роль ВЫВОДИТСЯ из
// сглаженных темпов соседей и из того, в каких они колоннах. Отсюда и берётся
// «логика», которой у точек не было.
//
// Смена колонны — единственное дискретное решение во всём слое, и принимается
// оно ЗАРАНЕЕ (не ближе SETUP). Так устроен и настоящий обгон: сначала выходишь
// на другую линию, потом сокращаешь дистанцию. Порядок обратный (перестроение
// одновременно со сближением) даёт наложение кузовов ровно в момент обгона —
// ловилось стендом tools/sim/track.js.
const CLOSE = 30         // px — дистанция, с которой начинается борьба
const SETUP = 11         // px — с какой дистанции готовится обгон (не ближе!)
const APEX = 2.2         // px — насколько срезать внутреннюю кромку
const LEAN = 0.7         // px — доп. наклон наружу у атакующего
const SQUEEZE = 1.6      // px — насколько защищающийся поджимает линию
const LANE_MAX = 6.2     // px — предел от осевой (полотно 19, кузов 6)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export class Duel {
  constructor(lapPx) { this.lapPx = lapPx }

  // Соседей берём из порядка по дистанции: впереди идущий — order[k-1],
  // сзади — order[k+1].
  plan(cars, order, dt) {
    for (let k = 0; k < order.length; k++) {
      const c = cars[order[k]]
      const ahead = k > 0 ? cars[order[k - 1]] : null
      const behind = k < order.length - 1 ? cars[order[k + 1]] : null
      const gapA = ahead ? (ahead.dist - c.dist) * this.lapPx : 1e9
      const gapB = behind ? (c.dist - behind.dist) * this.lapPx : 1e9
      const decay = Math.min(1, dt * 3)
      const apex = c.frame.apex * APEX
      let lean = 0

      // Перестроение закончено, когда машина встала в центр своей колонны с
      // учётом апекса: только тогда Formation отпускает её от прежних соседей.
      if (c.cross && Math.abs(c.lane - (c.col * COL + apex)) < 1.8) c.cross = 0

      if (gapA < CLOSE && ahead && c.pace > ahead.pace * 1.002) {
        if (ahead.col === c.col && gapA > SETUP && this.colFree(cars, c, -c.col)) {
          c.col = -c.col
          c.cross = 1
        }
        if (ahead.col !== c.col) {
          c.attack = Math.min(1, c.attack + dt * 4)
          lean = LEAN * c.col
          c.draft -= c.draft * decay
        } else {
          // Места нет — сидим в спине и ждём. Это и есть слипстрим.
          c.draft = Math.min(1, c.draft + dt * 4)
          c.attack -= c.attack * decay
        }
      } else {
        if (gapA < CLOSE && ahead && ahead.col === c.col) {
          c.draft = Math.min(1, c.draft + dt * 4)
        } else {
          c.draft -= c.draft * decay
        }
        c.attack -= c.attack * decay
      }

      let squeeze = 0
      if (gapB < CLOSE && behind && behind.pace > c.pace * 1.002) {
        c.defend = Math.min(1, c.defend + dt * 4)
        // Блокировка: поджимаем линию претендента, пока он ЕЩЁ СЗАДИ. Когда он
        // уже рядом, поджимать нельзя — это въезд в кузов, а не защита.
        if (c.mode === 'defend' && gapB > PAIR) squeeze = SQUEEZE * behind.col
      } else {
        c.defend -= c.defend * decay
      }

      // Возврат в свою колонну, когда борьбы нет: иначе за долгий прогон все
      // десять сползают в одну колонну и пелотон едет гуськом.
      if (gapA > CLOSE && gapB > CLOSE && c.col !== c.home && this.colFree(cars, c, c.home)) {
        c.col = c.home
        c.cross = 1
      }

      // Апекс — слагаемое, общее для всех машин в этой точке трассы, поэтому
      // просвет между колоннами он не съедает (см. Formation.js).
      c.laneT = clamp(c.col * COL + apex + lean + squeeze, -LANE_MAX, LANE_MAX)
    }
  }

  // Есть ли место в колонне. Радиус с запасом к длине кузова: перестроение
  // занимает ~0.13 с, и за это время дистанция ещё сокращается — впритык
  // перестраиваться нельзя.
  colFree(cars, c, col) {
    const min = (PAIR * 1.35) / this.lapPx
    for (const o of cars) {
      if (o === c || Math.abs(o.dist - c.dist) >= min) continue
      // Занято, если соперник либо целится в эту колонну, либо ещё физически
      // из неё не уехал.
      if (o.col === col || held(o) === col) return false
    }
    return true
  }
}
