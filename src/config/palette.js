// Палитра снята ПИПЕТКОЙ с `teardown/ref/main-early.png` (шаг 0 дорожной карты).
// До появления кадров у нас была тёмная тема — оригинал светлый, и это
// расхождение оказалось крупнее всех расхождений по композиции вместе взятых.
// Тёмная осталась ровно в двух местах: панель гонки и кнопка CLASSES.
export const PAL = {
  bg:        0xf6f9fc, // [F] фон экрана
  chrome:    0xe0e7ef, // [F] шапка и нижнее меню
  panel:     0xffffff, // [F] карточка
  panelAlt:  0xf0f4f9, // [F] внутренняя плашка карточки
  line:      0xdde5ee, // [F] граница
  text:      0x151f32, // [F] заголовок
  muted:     0x8a93a5,
  dim:       0xb6becc,
  accent:    0x2465e4, // [F] основная кнопка
  accentDim: 0x1d56c1, // [F] вложенный ценник в кнопке
  green:     0x17c257, // [F] зелёная кнопка (Watch)
  greenDim:  0x0fa100, // [F] доход и прирост текстом
  red:       0xe8232b, // [F] имя команды
  gold:      0xf9a31b, // [F] рейтинг Legend
  cyan:      0x2196f3,
  purple:    0xa06bff,

  // Тёмная панель гонки — единственный тёмный блок на экране.
  dark:      0x02081e, // [F]
  darkAlt:   0x0f1f31, // [F]
  onDark:    0xffffff,
  ribbon:    0xa9b4c9, // [F] лента прогресса кругов над картой

  // Трасса: вид сверху, зелёное поле с песчаными обочинами.
  grass:     0x5aa84f,
  grassDark: 0x3e7d34,
  sand:      0xe3cfa3,
  road:      0x8a8f96,
  water:     0x4fa8e8,
  concrete:  0xd7dbe0,
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Те же цвета строками — для style-объектов Phaser.Text.
export const CSS = Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, hex(v)])
)

// Контрастный текст на произвольной заливке. Нужен потому, что после перехода
// на светлую тему одна и та же кнопка бывает и синей, и почти белой: жёстко
// зашитый белый текст на `panelAlt` читался бы как пустая плашка.
export function textOn(fill) {
  const r = (fill >> 16) & 255, g = (fill >> 8) & 255, b = fill & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? CSS.text : CSS.onDark
}

export const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif'

// Цвета точек участников: игрок всегда первый (оранжевый), дальше — как на
// кадре оригинала, включая чёрную и белую точки.
export const RACER_COLORS = [
  0xff8a1a, 0x35c3e0, 0x151515, 0xe8232b, 0x9b59ff,
  0xf2c40e, 0xff6fb5, 0xffffff, 0x3ecf5d, 0x2f7fe4,
]
