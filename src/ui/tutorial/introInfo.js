import { PAL } from '../../config/palette.js'
import { SCREEN_INTRO } from '../../config/tutorial.js'

// Перевод описания экрана в тот же объект, которым питается справка по ⓘ.
// Отдельным файлом, а не полем в конфиге: конфиг держит ТЕКСТЫ, а форма окна —
// дело UI, и менять её на шести описаниях сразу не придётся.
export const introInfo = (key) => {
  const s = SCREEN_INTRO[key]
  if (!s) return null
  return {
    key: 'intro:' + key,   // не совпадает ни с одним слотом → векторный значок не рисуется
    emoji: s.icon,
    title: s.title,
    badge: s.badge,
    color: PAL.accent,
    body: s.body,
    note: s.note,
    rows: [],
    lock: null,
  }
}
