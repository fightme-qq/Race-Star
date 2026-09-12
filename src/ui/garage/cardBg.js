import { PAL } from '../../config/palette.js'

// Подложка группы строк — одна на все вкладки гаража. Рисуется в ОБЩИЙ graphics
// вида, а не отдельным объектом на каждую карточку: десяток Graphics на экран
// стоил бы дороже, чем всё остальное содержимое вкладки (так же сделано в
// магазине — ShopRow.sectionCard).
export function card(g, y, w, h, { stroke = PAL.line, width = 1 } = {}) {
  g.fillStyle(PAL.panel, 1)
  g.fillRoundedRect(0, y, w, h, 14)
  g.lineStyle(width, stroke, 1)
  g.strokeRoundedRect(0, y, w, h, 14)
  return y + h
}
