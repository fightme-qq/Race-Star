// Плоская мобильная палитра, снятая с кадров оригинала:
// тёмный сине-серый фон, оранжевый акцент, красное имя команды, зелёные кнопки покупки.
export const PAL = {
  bg:        0x0f1117,
  panel:     0x1a1e2b,
  panelAlt:  0x232839,
  line:      0x2e3446,
  accent:    0xff7a1a,
  accentDim: 0xc25a0d,
  green:     0x2ecc71,
  greenDim:  0x1f8f4e,
  red:       0xe63946,
  gold:      0xffc94d,
  cyan:      0x4dd0e1,
  purple:    0xa06bff,
  text:      0xffffff,
  muted:     0x8a90a6,
  dim:       0x5c6379,
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Те же цвета строками — для style-объектов Phaser.Text.
export const CSS = Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, hex(v)])
)

export const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif'

// Цвета точек участников на трассе: игрок всегда первый (оранжевый).
export const RACER_COLORS = [
  0xff7a1a, 0x4dd0e1, 0x2ecc71, 0xe63946, 0xffc94d,
  0xa06bff, 0xff6fb5, 0x6ec1ff, 0xb0bec5, 0x8bc34a,
]
