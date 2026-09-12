// Стенд трассы. Всё, что он проверяет, было ЖИВЫМ дефектом, и ни один из них не
// ловился ни сборкой, ни смоук-тестом — только глазом на движении точек:
//
//   1. разрыв кривой на линии старт/финиш (точка прыгала на ~44 px);
//   2. неравномерный темп из-за параметра сплайна (сегменты разной длины);
//   3. сброс позиций при смене заезда каждые 60 секунд (~400 px);
//   4. машины, едущие в одной точке.
//
// Главная цифра — максимальный ПЕРЕСКОК позиции за кадр: любой телепорт даёт в
// ней выброс, где бы он ни возник. Первые три дефекта на ней видны сразу, и
// именно она держит правку от регрессий.
//
// Прогон: npm run sim:track
import { TrackPath } from '../../src/ui/track/TrackPath.js'
import { RacerLayer } from '../../src/ui/track/RacerLayer.js'
import { SHAPE } from '../../src/ui/track/shape.js'
import { RaceSimulation } from '../../src/systems/RaceSimulation.js'
import { RACE } from '../../src/config/balance.js'

const W = 354, H = 156          // фактический бокс карты на 390px экране
const path = new TrackPath(W, H, SHAPE)
const fail = []
const check = (ok, name, detail) => {
  if (!ok) fail.push(name)
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(46)} ${detail}`)
}

console.log(`\nгеометрия  длина круга ${path.length.toFixed(1)} px`)

// 1. Равномерность по дуге: равный шаг по u — равный путь в пикселях.
let minS = 1e9, maxS = 0
for (let j = 0; j < 2000; j++) {
  const a = path.at(j / 2000), b = path.at((j + 1) / 2000)
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  minS = Math.min(minS, d)
  maxS = Math.max(maxS, d)
}
check(maxS / minS < 1.15, 'шаг по дуге равномерен', `разброс x${(maxS / minS).toFixed(3)}`)

// 2. Замкнутость. Сюда упирался главный дефект: getPoint(1) у прежнего сплайна
// возвращал ВТОРУЮ опорную точку, а не первую.
const w0 = path.at(0), w1 = path.at(0.99999)
check(Math.hypot(w1.x - w0.x, w1.y - w0.y) < 0.6, 'кольцо замкнуто на линии старта',
  `стык ${Math.hypot(w1.x - w0.x, w1.y - w0.y).toFixed(3)} px`)

// 3. Профиль скорости: круг проходится за то же время, но с торможением в
// поворотах. Проверяем и то, что разгон есть, и то, что нет остановки.
let tMin = 1e9, tMax = 0, sum = 0
for (let j = 0; j < 1000; j++) {
  const a = path.atLapTime(j / 1000), b = path.atLapTime((j + 1) / 1000)
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  tMin = Math.min(tMin, d)
  tMax = Math.max(tMax, d)
  sum += d
}
check(Math.abs(sum - path.length) / path.length < 0.01, 'круг по времени = круг по дуге',
  `${sum.toFixed(1)} vs ${path.length.toFixed(1)} px`)
check(tMax / tMin > 1.4 && tMax / tMin < 3.5, 'в поворотах тормозит, на прямых едет',
  `перепад темпа x${(tMax / tMin).toFixed(2)}`)

// 4. Поведение на стыке заездов. Повторяем порядок вызовов RaceController:
// шаг симуляции -> при финише СРАЗУ новый заезд -> отрисовка. Именно в этом
// кадре точки и телепортировались на старт.
console.log('\nповедение  6 заездов, 60 fps')
const mk = () => new RaceSimulation({
  playerOffense: 50, playerDefense: 50, leaguePower: 190,
  seed: Math.floor(Math.random() * 1e9),
})
let sim = mk()
const layer = new RacerLayer(path, () => {})
const stepSize = 1 / RACE.tickHz
const dt = 1 / 60
const BODY_L = 11, BODY_W = 6      // габарит кузова, см. CarPainter
let acc = 0, races = 0, frames = 0, backwards = 0
let maxJump = 0, jumpAt = ''
let touch = 0, deep = 0, streak = 0, maxStreak = 0, worst = BODY_W, worstAt = ''
const prevXY = layer.cars.map(() => null)

for (let frame = 0; races < 6; frame++) {
  acc += dt
  while (acc >= stepSize && !sim.finished) {
    sim.step(stepSize)
    acc -= stepSize
  }
  const alpha = Math.min(1, acc / stepSize)
  const flipped = sim.finished
  if (flipped) { sim = mk(); races++ }

  const before = layer.cars.map((c) => c.dist)
  layer.update(sim, alpha, dt)
  frames++

  layer.cars.forEach((c, i) => {
    if (c.dist < before[i] - 1e-9) backwards++
    const p = prevXY[i]
    if (p && frame > 1) {
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d > maxJump) {
        maxJump = d
        jumpAt = `машина ${i}, кадр ${frame}${flipped ? ' (стык заездов)' : ''}`
      }
    }
    prevXY[i] = { x: c.x, y: c.y }
  })

  // Наложение кузовов считаем в связанных осях: вдоль трассы — по дистанции,
  // поперёк — по смещению от осевой. Пара, идущая БОРТ О БОРТ в разных
  // колоннах, стоит рядом законно, и именно она даёт картинку борьбы.
  let deepHere = false, touchHere = false
  for (let a = 0; a < layer.cars.length; a++) {
    for (let b = a + 1; b < layer.cars.length; b++) {
      const A = layer.cars[a], B = layer.cars[b]
      if (Math.abs(A.dist - B.dist) * path.length >= BODY_L - 2) continue
      const across = Math.abs(A.lane - B.lane)
      if (across >= BODY_W) continue
      touchHere = true
      if (across < BODY_W / 2) deepHere = true
      if (across < worst) {
        worst = across
        worstAt = `кадр ${frame}, машины ${a}/${b}`
      }
    }
  }
  if (touchHere) touch++
  if (deepHere) {
    deep++
    streak++
    if (streak > maxStreak) maxStreak = streak
  } else {
    streak = 0
  }
}

// Порог 5 px: на прямой машина проходит за кадр ~2.5 px, в повороте ~1.3,
// потолок — быстрая машина на прямой с максимальной поправкой (см. ограничитель
// в RacerLayer.advance). Прежний разрыв на линии давал 44 px, сброс заезда — 400.
check(maxJump < 5, 'нет перескоков позиции ни в одном кадре',
  `максимум ${maxJump.toFixed(2)} px — ${jumpAt}`)
check(backwards === 0, 'дистанция только растёт', `назад ${backwards} раз`)

// Наложение кузовов проверяется БЮДЖЕТОМ, а не нулём, и вот почему.
//
// Кузов 11x6 px, полотно 19 px: две машины борт о борт занимают почти всю
// ширину, и кромки кузовов при этом неизбежно сходятся на 1-2 px. Это
// «касание», его 12-18% кадров, и выглядит оно ровно как плотная борьба, ради
// которой слой и написан. Убирать его — значит разогнать пелотон по одному.
//
// Грубое наложение (перекрытие больше половины ширины) — уже дефект, но ноль
// здесь стоит дороже, чем стоит сам дефект. Остаточный механизм один и он
// измерен: после смены места в очереди дистанции доходят до новых целей за
// ~0.5 с (CONVERGE), и если в эти полсекунды одна из пары ещё и перестраивается
// между колоннами, кузова на 1-2 КАДРА перекрываются. Чтобы этого не было
// совсем, нужен жёсткий разбор столкновений по фактическим позициям — то есть
// мгновенные поправки, ровно тот рывок, от которого весь слой и избавлялся.
//
// Поэтому проверяем два числа: долю таких кадров (доли процента) и ДЛИТЕЛЬНОСТЬ
// эпизода. Второе важнее первого: мигание на два кадра не видно вовсе, а вот
// машины, поехавшие слипшись на секунду, были бы видны сразу.
check(deep / frames < 0.0025, 'грубых наложений кузовов практически нет',
  `${deep} кадров из ${frames} (${(100 * deep / frames).toFixed(3)}%), худший просвет ${worst.toFixed(2)} px — ${worstAt}`)
check(maxStreak <= 6, 'наложение всегда мгновенное, а не длящееся',
  `самый долгий эпизод ${maxStreak} кадров (${(maxStreak / 60 * 1000).toFixed(0)} мс)`)
console.log(`  · касания кромок кузовов: ${(100 * touch / frames).toFixed(1)}% кадров — плотная борьба, так и задумано`)

console.log(fail.length ? `\nПРОВАЛ: ${fail.join(', ')}\n` : '\nвсё чисто\n')
process.exit(fail.length ? 1 : 0)
