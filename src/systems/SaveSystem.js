const KEY = 'race-star-save'
// 2: roster (драйверы, состав, pity); 3: cls.career (карьерный драйвер);
// 4: имя команды переехало из корня в класс — в оригинале оно у каждого своё.
// 5: шаг 2 — экономика пересобрана (доход = фанаты / 1188, ветка платит за
//    гонку). Ключи уровней те же, но стоят и дают другое, поэтому старый сейв
//    не переносится: у игрока с 30 уровнями прежней ветки получилась бы
//    экономика, которой не соответствует ни одна цена.
const VERSION = 5

export const SaveSystem = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (data.version !== VERSION) return null
      return data
    } catch (err) {
      console.warn('[save] повреждено, начинаем заново', err)
      return null
    }
  },

  save(payload) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...payload, version: VERSION }))
      return true
    } catch (err) {
      console.warn('[save] не удалось записать', err)
      return false
    }
  },

  wipe() { localStorage.removeItem(KEY) },
}
