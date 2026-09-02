const KEY = 'race-star-save'
const VERSION = 3   // 2: roster (драйверы, состав, pity); 3: cls.career (карьерный драйвер)

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
