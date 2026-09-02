import { PAL } from '../config/palette.js'

// [F] На кадре у боевых слотов иконки нарисованные, а не эмодзи: красная
// мишень, оранжевая кардиограмма, синий щит, фиолетовая кардиограмма — по
// одной на слот, во всех классах одинаковые. Эмодзи сюда не годятся: 🛡 и ⚔
// в большинстве шрифтов монохромные, и карточка теряет цветовой код слота.
const SLOT = {
  c0: { kind: 'target', color: 0xe23b3b },
  c1: { kind: 'pulse',  color: 0xff7a1a },
  c2: { kind: 'shield', color: 0x2465e4 },
  c3: { kind: 'pulse',  color: 0xa06bff },
  t0: { kind: 'target', color: PAL.gold },
  t1: { kind: 'shield', color: PAL.gold },
}

// Экономические слоты в кадрах не разглядеть — там эмодзи-заглушки [X].
export const EMOJI = { e0: '🎟', e1: '🅿️', e2: '👥', e3: '🏆' }

export function drawUpgradeIcon(g, key, cx, cy) {
  const spec = SLOT[key]
  if (!spec) return false
  const { kind, color } = spec

  if (kind === 'target') {
    g.fillStyle(color, 1); g.fillCircle(cx, cy, 12)
    g.fillStyle(PAL.panelAlt, 1); g.fillCircle(cx, cy, 8.5)
    g.fillStyle(color, 1); g.fillCircle(cx, cy, 5)
    g.fillStyle(PAL.panelAlt, 1); g.fillCircle(cx, cy, 2)
    return true
  }

  if (kind === 'shield') {
    g.fillStyle(color, 1)
    g.beginPath()
    g.moveTo(cx, cy - 12)
    g.lineTo(cx + 10, cy - 7)
    g.lineTo(cx + 10, cy + 2)
    g.lineTo(cx, cy + 12)
    g.lineTo(cx - 10, cy + 2)
    g.lineTo(cx - 10, cy - 7)
    g.closePath()
    g.fillPath()
    g.fillStyle(PAL.panelAlt, 1)
    g.beginPath()
    g.moveTo(cx, cy - 7)
    g.lineTo(cx + 6, cy - 4)
    g.lineTo(cx + 6, cy + 1)
    g.lineTo(cx, cy + 7)
    g.lineTo(cx - 6, cy + 1)
    g.lineTo(cx - 6, cy - 4)
    g.closePath()
    g.fillPath()
    return true
  }

  // Кардиограмма: ломаная в одну линию.
  const pts = [[-12, 2], [-6, 2], [-3, -9], [1, 9], [5, -4], [8, 2], [12, 2]]
  g.lineStyle(2.5, color, 1)
  g.beginPath()
  pts.forEach(([dx, dy], i) => (i ? g.lineTo(cx + dx, cy + dy) : g.moveTo(cx + dx, cy + dy)))
  g.strokePath()
  return true
}
