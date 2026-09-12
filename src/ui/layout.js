import Phaser from 'phaser'

// Хелперы раскладки. Главный принцип: позиция элемента считается из ИЗМЕРЕННОГО
// размера соседа, а не из угаданной константы. Все наложения, что были на
// экране, — это места, где ширину текста угадали: «⚔ 108» помещалось, а
// «⚔ 1.2M» уже нет; «Attacking» помещалось, «Celebrations» — нет.

const sizeOf = (t) => parseInt(t.style.fontSize, 10) || 12

// Ужать шрифт, пока строка не влезет в maxW. Возвращает сам текст.
export function fitText(t, maxW, minSize = 8) {
  let size = sizeOf(t)
  while (t.width > maxW && size > minSize) t.setFontSize(--size)
  return t
}

// То же для многострочного текста: подбираем размер так, чтобы и самая длинная
// строка влезла по ширине, и весь блок — по высоте. Нужно карточке апгрейда:
// «Victory Celebrations» и «Throttle Control» должны занимать одно и то же
// место, иначе сетка дышит.
export function fitWrapped(t, maxW, maxH, minSize = 9) {
  let size = sizeOf(t)
  t.setWordWrapWidth(maxW)
  while ((t.width > maxW || t.height > maxH) && size > minSize) {
    t.setFontSize(--size)
    t.setWordWrapWidth(maxW)
  }
  return t
}

// Поставить текст по вертикальному центру коробки (boxY..boxY+boxH).
// Явный хелпер вместо «y + 4»: высота текста зависит от кегля и шрифта, и
// подобранная на глаз добавка ломалась, как только кегль менялся.
export function vcenter(t, boxY, boxH) {
  t.setY(Math.round(boxY + (boxH - t.height) / 2))
  return t
}

// Разложить ряд элементов слева направо от измеренных ширин: x_i зависит от
// правого края предыдущего. Возвращает правый край ряда.
export function flowRow(items, x, gap) {
  let cx = x
  for (const t of items) {
    if (!t.text) continue          // пустую метку пропускаем, зазор не съедаем
    t.setX(cx)
    cx += t.width + gap
  }
  return cx - gap
}

// Равные колонки: центры n элементов в полосе x..x+w с зазором gap.
export function columns(x, w, n, gap) {
  const cw = (w - gap * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({
    x: x + (cw + gap) * i,
    cx: x + (cw + gap) * i + cw / 2,
    w: cw,
  }))
}

// Градиентное затухание у нижней кромки скролла. Без него список, обрезанный
// маской, читается как «сломанная вёрстка»: строка отрезана ровно пополам.
// Градиента у Phaser.Graphics нет, поэтому рисуем полосками — 12 штук хватает,
// чтобы ступеньки не читались.
export function fadeStrip(g, x, y, w, h, color, steps = 12) {
  const sh = h / steps
  for (let i = 0; i < steps; i++) {
    g.fillStyle(color, Phaser.Math.Easing.Quadratic.In((i + 1) / steps))
    g.fillRect(x, y + sh * i, w, sh + 1)
  }
  return g
}
