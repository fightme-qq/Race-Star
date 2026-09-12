import { PAL } from '../../config/palette.js'

// Машина крупным планом для вкладки косметики.
//
// ПОЧЕМУ НЕ CarPainter. Он рисует кузов 11x6 px — точку на карте, и всё в нём
// (обводка 1 px, смещение тени 1x1.5 px) считается в этих же пикселях. Превью
// требует ~7x, а масштабирование графики тянет за собой и обводку: замер на
// кадре дал 7-пиксельный серый кант и восьмиугольник вместо силуэта — машина
// перестала читаться машиной. Поэтому здесь своя отрисовка, в тех же пропорциях
// 2:1, а на карте остаётся CarPainter: переписывать его под превью значило бы
// менять вид гонки ради гаража.
export const PREVIEW = { w: 118, h: 52 }

const WHEELS = [[0.26, -0.5], [0.26, 0.5], [-0.28, -0.5], [-0.28, 0.5]]

export function drawCarPreview(g, cx, cy, color, decalId) {
  const { w: L, h: W } = PREVIEW
  const x = cx - L / 2, y = cy - W / 2
  const r = W * 0.34

  g.fillStyle(0x000000, 0.12)
  g.fillRoundedRect(x + 3, y + 6, L, W, r)

  g.fillStyle(PAL.dark, 1)
  for (const [wx, wy] of WHEELS) {
    g.fillRoundedRect(cx + L * wx - 9, cy + W * wy - 5, 18, 10, 4)
  }

  g.fillStyle(color, 1)
  g.fillRoundedRect(x, y, L, W, r)
  g.lineStyle(1.5, PAL.dark, 0.35)
  g.strokeRoundedRect(x, y, L, W, r)

  decal(g, cx, cy, decalId)

  // Кабина: крыша тёмным, стекло светлым клином к носу. Это то, что делает
  // силуэт машиной, а не таблеткой, — на 11 px оно не помещается вовсе.
  g.fillStyle(PAL.darkAlt, 0.92)
  g.fillRoundedRect(cx - L * 0.16, y + W * 0.16, L * 0.34, W * 0.68, 8)
  g.fillStyle(PAL.cyan, 0.5)
  g.fillRoundedRect(cx + L * 0.1, y + W * 0.22, L * 0.07, W * 0.56, 4)
}

// Декали — та же пятёрка, что в DECALS: полосы, огонь, молния, клетка.
function decal(g, cx, cy, id) {
  const { w: L, h: W } = PREVIEW
  if (id === 'stripes') {
    g.fillStyle(PAL.onDark, 0.85)
    for (const s of [-1, 1]) g.fillRect(cx - L * 0.5, cy + s * W * 0.16 - 3, L, 6)
  } else if (id === 'flames') {
    g.fillStyle(PAL.gold, 0.9)
    for (let i = 0; i < 3; i++) {
      const fx = cx - L * 0.46 + i * 12
      g.fillTriangle(fx, cy - W * 0.3, fx + 22, cy, fx, cy + W * 0.3)
    }
  } else if (id === 'bolts') {
    g.lineStyle(4, PAL.gold, 0.95)
    g.beginPath()
    g.moveTo(cx - L * 0.42, cy - W * 0.2)
    g.lineTo(cx - L * 0.1, cy + W * 0.1)
    g.lineTo(cx + L * 0.08, cy - W * 0.14)
    g.lineTo(cx + L * 0.42, cy + W * 0.18)
    g.strokePath()
  } else if (id === 'checker') {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle((i + j) % 2 ? PAL.onDark : PAL.dark, 0.85)
        g.fillRect(cx - L * 0.5 + i * 15, cy - W * 0.34 + j * 9, 15, 9)
      }
    }
  }
}
