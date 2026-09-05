// ЧИСЛА магазина (вкладка 6). Метки как везде, плюс одна новая:
//   [F] — снято с кадров / витрины App Store
//   [E] — строка из локализации билда (teardown/work/loc/en.json)
//   [~] — реконструкция, [X] — наш баланс
//
// ГЛАВНОЕ ОГРАНИЧЕНИЕ ЭТОГО ЭКРАНА, и его надо назвать прямо: магазин в
// оригинале — это целиком поверхность реальных денег. Витрина App Store даёт
// десять точных цен [F], локализация — полный список позиций [E], но НИ ОДНОГО
// кадра самого экрана нет (как и у вкладок 2, 4, 5 — см. ref/index.json).
//
// Правило, по которому здесь всё разложено:
//   всё, что в оригинале стоит ДОЛЛАРОВ, у нас показано с ценой [F] и НЕ
//   покупается; всё, что стоит ГЕМОВ, работает.
// Единственное исключение — `Rookie Pass` (см. ROOKIE_PASS ниже): у него цена
// в гемах [X], потому что иначе премиум-ветка Season Pass с шага 4 осталась бы
// заблокированной навсегда, а это половина уже нарисованного экрана.
//
// Придумывать гемовые цены остальным IAP мы не стали намеренно: `No Ads`,
// `Double Income Booster` и `x2 Resources` — это ПОСТОЯННЫЕ множители дохода.
// Продать их за гемы значило бы вписать в экономику вторую ось разгона, которой
// в оригинале нет, и подбирать её вслепую поверх и без того узкого окна
// шага 3b.

export const IAP_NOTE = 'In-app purchases are unavailable in this build'

// --- Гемы за деньги ------------------------------------------------------
// Имена лестницы — [E] (`Handful / Pouch / Bag / Bucket / Chest / Pile of Gems`).
// Из цен известна ровно одна: `Pile of Gems $1.99` [F] с витрины. Порядок
// остальных ступеней наш [X] — по названию тары его не восстановить, а витрина
// показывает только десять самых покупаемых позиций, не весь каталог.
export const GEM_PACKS = [
  { id: 'handful', name: 'Handful of Gems', usd: 0.99, gems: 80 },
  { id: 'pile',    name: 'Pile of Gems',    usd: 1.99, gems: 180, tag: 'Popular' },   // [F] цена
  { id: 'pouch',   name: 'Pouch of Gems',   usd: 4.99, gems: 500 },
  { id: 'bag',     name: 'Bag of Gems',     usd: 9.99, gems: 1100 },
  { id: 'bucket',  name: 'Bucket of Gems',  usd: 19.99, gems: 2400 },
  { id: 'chest',   name: 'Chest of Gems',   usd: 49.99, gems: 6500, tag: 'Best Value' },  // [E] `Best Value`
]

// --- Деньги за гемы ------------------------------------------------------
// Имена [E] (`Instant Cash`, `Cash Stack`, `Cash Bundle`, `Cash Vault`).
// Это единственная часть магазина, которая ВЛИЯЕТ НА БАЛАНС, поэтому она же
// единственная, где числа проходили через стенд.
//
// Выплата меряется В СЕКУНДАХ ДОХОДА, а не в долларах, — по той же причине, что
// призовые, продажа драйвера и награды вкладки 5 (правило 8b): плоская сумма к
// середине игры отстаёт от экономики на порядки, и кнопка умирает.
//
// Лимит в день — не украшение. Без него курс «секунды за гем» сравнивается с
// гачей ОДИН раз за всю игру, и та из двух трат, что оказалась выгоднее,
// забирает весь приток гемов навсегда: либо магазин пустой, либо вторая ось
// силы мёртвая. С лимитом дневная порция уходит в деньги, остаток — в паки, и
// обе траты живут. В оригинале ровно эта же конструкция подписана `Limited
// Deals` и `Only one purchase can be made` [E].
export const CASH_PACKS = [
  { id: 'instant', name: 'Instant Cash', gems: 10,  sec: 900,   perDay: 3 },   // [X]
  { id: 'stack',   name: 'Cash Stack',   gems: 25,  sec: 2400,  perDay: 2 },   // [X]
  { id: 'bundle',  name: 'Cash Bundle',  gems: 60,  sec: 6300,  perDay: 1 },   // [X]
  { id: 'vault',   name: 'Cash Vault',   gems: 150, sec: 17000, perDay: 1 },   // [X]
]

// Общий множитель выплаты — координата перебора (tools/sim/tune.js). Держим
// отдельно от таблицы, чтобы подбор двигал курс целиком, а не ломал лесенку
// «дороже пак — выгоднее курс».
export const SHOP = {
  cashRateMult: 1.0,   // [X] подобран прогоном
}

// --- Бесплатное ----------------------------------------------------------
// `Free Daily Gems` / `Grab {0} free every day` [E] и `Free Gems` /
// `Watch an ad to get gems` [E].
//
// Реклама здесь ЗАКРЫВАЕТ РАСХОЖДЕНИЕ, записанное в FINDINGS на шаге 4:
// дневная задача `Watch an ad 1/1` [F] против лимита ~6 реклам на класс [F]
// означала, что задачу можно выполнить всего 36 раз за всю игру, после чего она
// висит невыполнимой. Лимит 6 относится к бусту `Activate 2x`; в магазине
// реклама смотрится отдельно и своим счётчиком — как и предполагалось в отчёте.
export const FREE = {
  dailyGems: 25,      // [X] `Grab {0} free every day`
  adGems: 10,         // [X] за просмотр
  adsPerDay: 5,       // [X]
}

// --- Season Pass premium -------------------------------------------------
// В оригинале это IAP `Rookie Pass $4.99` [F]. У нас — единственная позиция
// магазина с гемовой ценой, и вот почему: шаг 4 нарисовал премиум-ветку пасса и
// заблокировал её «до магазина». Оставить её заблокированной и здесь значило бы
// навсегда похоронить половину уже сделанного экрана.
// Цена [X] и входит в перебор: эффект ветки измерим и ограничен одним сезоном
// пасса, в отличие от постоянных множителей `No Ads` и `x2 Resources`.
export const ROOKIE_PASS = { id: 'rookie', name: 'Rookie Pass', usd: 4.99, gems: 400 }

// --- Витрина реальных денег ----------------------------------------------
// Ниже — то, что показано и НЕ покупается. Цены с витрины [F] там, где витрина
// их дала; остальные [X]. Состав и подписи — [E].

// «Purchase the previous stage first» [E]: фонды идут ступенями, следующая
// открывается покупкой предыдущей. Цены первых ступеней сняты с витрины.
export const FUNDS = [
  { id: 'gem',     name: 'Gem Fund',         stages: 3, usd: [2.99, 5.99, 11.99], desc: 'Collect gems while offline' },
  { id: 'premium', name: 'Premium Gem Fund', stages: 3, usd: [4.99, 9.99, 19.99], desc: 'Higher daily gem income' },   // [F] St.1 $4.99
  { id: 'vip',     name: 'VIP Gem Fund',     stages: 3, usd: [19.99, 39.99, 79.99], desc: 'The largest gem income' },  // [F] St.1 $19.99
]

// «Monthly Passes activate special bonuses for 30 days after purchase. You can
// have multiple Monthly Passes active at the same time» [E].
export const MONTHLY = [
  { id: 'daily', name: 'Daily Gems Pass', usd: 9.99, days: 30, desc: 'Free gems every day' },
  { id: 'idle',  name: 'Idle Gems Pass',  usd: 9.99, days: 30, desc: 'Collect gems while offline' },
]

export const BOOSTERS = [
  { id: 'noads',  name: 'No Ads',                usd: 9.99, desc: 'Get rewards without watching ads' },   // [F]
  { id: 'income', name: 'Double Income Booster', usd: 4.99, desc: 'Increases Cash earnings by 2x' },      // [F]
  { id: 'x2',     name: 'x2 Resources',          usd: 14.99, desc: 'Earn race rewards twice as fast' },   // [E]
  { id: 'cap',    name: 'Rush Gems Cap 2x',      usd: 9.99, desc: 'Doubles the daily gem cap' },          // [E]
]

// `Welcome Pack $2.99` [F], `Sprint Pass $4.99` [F]; остальные подписи [E].
export const OFFERS = [
  { id: 'welcome',  name: 'Welcome Pack',        usd: 2.99, tag: 'One Time Offer', desc: 'Gems, cash and an exclusive avatar' },
  { id: 'sprint',   name: 'Sprint Pass',         usd: 4.99, tag: 'Limited Deals',  desc: 'Boost your progress for a limited time' },
  { id: 'starter',  name: 'Starter Pack',        usd: 0.99, tag: 'One Time Offer', desc: 'A head start for a new class' },
  { id: 'ultimate', name: 'Ultimate Starter Pack', usd: 19.99, tag: 'Best Value',  desc: 'Everything a new team needs' },
  { id: 'legend',   name: 'Legendary Offer',     usd: 29.99, tag: 'Limited Deals', desc: 'A limited-time deal with high value' },
]
