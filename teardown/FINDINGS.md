# Race Star — Team Manager Game: разбор билда

Источник: `com.coolcatsgames.racestaridle` v1.4.1 (versionCode 511, сборка 2026-08-18),
XAPK 262 МБ с apkpure. Издатель Gryphon Games UG.

## Этап 0-1: опознание

| признак | значение |
|---|---|
| движок | Unity **6000.0.62f1** |
| скриптинг | IL2CPP (`libil2cpp.so` 109 МБ, `global-metadata.dat` v31, 21 МБ) |
| managed-код | **нет** (.dll отсутствуют) → слой G дорогой |
| Addressables (`assets/aa`) | только локализация, 468 КБ |
| бэкенд | Nakama (heroiclabs) + Firebase (RTDB `race-star-idle-prod`) |
| нативный слой | только `config.armeabi_v7a` в XAPK (arm64 не отдали) |

## Слой A — таблицы данных: ПУСТО (важно)

В билде **18 TextAsset'ов**, из них игровых — ноль. Полный перебор 1592 файлов
`bin/Data` даёт 36 785 MonoBehaviour, но среди них **нет ни одного балансного
ScriptableObject**: только UI-префабы (`GryphonImageColorBinder` ×5561,
`SoundOnClick` ×1139 и т.п.), 525 игровых классов / 14 467 инстансов.

Вывод, подтверждённый двумя слоями (D + перепись содержимого):
**весь баланс приходит с сервера** через `ConfigLoaderService` /
`IRemoteConfigRepository`. В бинаре нет даже дефолтов.

Косвенное подтверждение из строк метаданных — тексты ошибок импортёра:
> `[CollectionsConfig] duplicate card values default to 0. Add a DuplicateValues sheet (cols: collection_id, rarity, coins) to the workbook and reimport.`
> `[DailyRewardsConfig] Expected at least one row in the Milestones_Rotation sheet. Fix the xlsx.`

То есть у дизайнеров баланс лежит в **xlsx-воркбуке**, импортируется в конфиги с
именами вида `<Config>_<ИмяЛиста>` и раздаётся клиенту с бэкенда.

**Следствие для нас:** числа брать неоткуда. Переносим **структуру и формы
формул** (это и есть game design), а числа проектируем свои и сверяем с кадрами.
Помечать всё как «наш баланс», не выдавать за оригинальный.

Технически: typetree в плеере вырезан, но восстанавливается генератором из
`libil2cpp.so` + `global-metadata.dat` (UnityPy + TypeTreeGeneratorAPI) — проверено,
деревья для `Features.Configs` генерируются корректно. Инструмент готов на случай,
если появится дамп серверного конфига.

## Слой D — карта систем (91 фича-модуль)

```
Ads, Adventures, AdventuresArena, AdventuresCup, Analytics, Audio, Authentication,
BanWords, BattlePass, BottomHUD, Camera, CampaignUpgrades, CareerPlayerSkins,
CareerPlayers, ChainedOffers, Chat, CheatDetection, Collections, Colors,
CombatResolver, Conditions, Configs, CupRewards, DailyGems, DailyRewards,
Development, DeviceSession, DurableBonus, Facebook, Firebase, GameRuntime,
GameSettings, Garage, GemSpendTracking, GemsCap, Gesture, GiftCodes, GrowthFund,
GryphonTheme, GuaranteedRewards, GuildConquest, Guilds, Iap, Leaderboard,
LeaderboardGlobal, LeaderboardRewards, LoadingScreen, LocalNotifications, LuckyDraw,
MailboxMessages, MainMenu, MatchSimulation, MonthlyPass, Offers, OffersChooseOne,
OffersFreeCash, OffersLimited, OffersUniquePlayers, OfflineIncome, Pause,
PlayTimeTracker, PlayerWallet, Profile, Prompt, Quest, QuestCounter, QuestCounters,
RateUs, RemoteConfig, ResourceIncome, RewardLanes, Rewards, RuntimeIncome, SaveGame,
SceneManagement, Shop, SkillTree, SportBreaker, SportBreakerGrowthFund,
SportStatAggregator, SportTeam, SportTeamGear, SportTeamPlayers,
SportTeamPlayersService, Stats, StatsAggregator, Tutorial, UIUtils, VanityItems,
VersionConfig, VisualEffects
```

### Чего НЕТ (отрицательный результат тоже результат)
- Нет физики/управления машиной: ни одного класса вождения. Гонка —
  **чистая симуляция чисел** + визуализация.
- Нет престижа/ребёрта: `Prestige`, `Rebirth`, `Ascend` — пустой grep.
- Нет энергии/топлива как валюты. Ограничитель — тикеты Арены и кулдауны.
- Нет крафта/разбора предметов. Только merge и апгрейд за шарды.

### Ключевые классы боёвки (`Features.MatchSimulation`)
```
WinChanceCalculator      RaceScoring          RaceTeamScore
StandardSportMatchSimulation   StandardSeasonSimulation
MatchRoundOutcome        MatchState           MatchSimulationSettings
SeededMatchRandom / UnityMatchRandom / IMatchRandom
OrderDifficultyData      MatchTimeScale       DoubleSpeedBonusApplier
RacingSimulationViewBase RacingVisualRunner   MatchPlaybackRunner
```
Симуляция **сидированная** (`SeededMatchRandom`) — сервер и клиент считают
одинаковый матч, отсюда реплеи (`MatchReplayPopup*`) и PvP без читов.

### Наследие рескина
В билде живы симуляции **Baseball, Basketball, Football, Hockey, Soccer, Tennis,
Volleyball** и целый модуль `SportBreaker` со своим конфигом. Race Star — рескин
движка спортивного тим-менеджера: «спорт» → «класс гонок», «игрок» → «драйвер».
Остались даже TextAsset'ы траекторий поля: `Field_Soccer`, `Field_Tennis` и т.д.
(160 точек x/y на каждый). Гоночного `Field_*` нет → трасса рисуется иначе.

## Слой E — локализация (1455 строк, англ.)

### Модель статов — главное
Три стата, **раздельно по каждому классу гонок**:
- **Offense** (атака / обгон)
- **Defense** (защита / удержание позиции)
- **Income** (доход)

Производные: **Team Power** → **Win Chance** (шанс победы = функция от отношения
своей и вражеской Team Power). Плюс **Power Level** (общий уровень аккаунта,
используется как порог входа в клубы).

### 6 классов (дисциплин)
`Racing` (Open-Wheel), `Rally`, `Stock Car`, `Superbike`, `Speedster`, `Monster Truck`.
Открываются по очереди за деньги (`SportUnlockPricesConfig`, `{0} of {1} sports unlocked`).

### Валюты
Cash · Gems · Trophies · Battle Points (Season Points) · Medals (Арена) ·
Arena Tickets · Keys · шарды драйверов/машин/гира/аутфитов · купоны паков
(`Standard/Elite Gear Coupon`, `Pro/All-Star Pack Coupon`) · Club Points.

### Редкости (единая шкала)
`Common → Uncommon → Rare → Epic → Epic+1 → Epic+2 → Legendary → Legendary+1 →
Legendary+2 → Legendary+3`

### Прогрессия ядра
- **Лиги**: Bronze → Silver → Gold → Platinum → Diamond → Elite → Expert
  (+ Advanced/Superior как тиры наград). «Win the season to advance».
- **Сезон**: таблица команд, W/L, `Current Season Standings`, `Season History`.
- **Апгрейды кампании**: за Cash, за Trophies, за уровень лиги
  (`CampaignUpgrades*: CashUpgrades / TrophyUpgrades / LeagueUpgrades`).

### Драйверы (`SportTeamPlayers`)
Скауг-паки → драйверы с редкостью → **Squad** (состав) и **Reserves** (резерв).
Механики: `Train` (скормить резервных драйверов, XP переносится),
`Merge` (объединить дубликаты), `Swap Driver`, `Sell`, звёзды
(`PlayerStarUpgrades`), уникальные драйверы (`UniquePlayers`, `Unique Cores`),
`Assign your driver to a class`.
Подсказки прямым текстом:
> `Training a leveled driver transfers all gained experience to the new player!`
> `Unique driver upgrades permanently consume one driver to strengthen another!`
> `Drivers in Squad cannot be used for upgrades`

### Гараж (`Features.Garage`)
Машины (`CarData`, звёзды `CarStarData`, апгрейд `CarUpgradeCost`), гир машины
(`GearContent`, `GearUpgradeCost`, паки), кастомизация (цвета/декали,
`GarageColorsUnlockService`), группы по классам (`SportGroups`).
Разблокировка машины: бесплатно / за гемы / за IAP (три типа кнопок).

### Гир драйверов (`SportTeamGear`)
Слоты, редкости, уровни (`GearConfig_LevelData`), паки с шансами
(`GEAR_PACK_CHANCE_TO_GET_DESCRIPTION`), купоны, merge.

### Карьерный драйвер (`CareerPlayers`) — отдельная система
Свой драйвер с **скилл-деревом**. Из инфо-попапа дословно:
> Train your Career Driver by playing races in the assigned class. Each race gives
> Career XP for that class. When your Career Driver gains enough XP, they level up
> and earn Skill Points. Spend Skill Points to unlock new skills. Skills can improve
> Offense, Defense, Income, and class-specific bonuses. You can reset your Skills at
> any time for Gems.

Скиллы — ~11 архетипов × 6 классов + глобальные, с трейд-оффами:
`Aggressive Play` (+Off драйверу / −Def команде), `Glass Cannon`,
`Counter Force` (Defense конвертится в Offense), `Sponsorships` (+Income) и т.д.
Отдельно **Outfits** (аутфиты): бонусы `For owning` + `For equipping`,
до 10 звёзд за шарды.

### Idle / офлайн
`OfflineIncomeService`, кап по времени (`Max {0}h`), докупка времени (`+{0} min`),
удвоение за рекламу (`ad_offline_income_double_reward`), `Idle Gems Pass` —
«Collect gems while offline». Пуш: `Idle income ready! 💰`.

### PvP и соревнования
- **Champions Arena**: 3 тикета/день, реролл в 05:00 UTC, Medals → ранг,
  лиги Bronze..Diamond, награды почтой. Матч = сравнение Team Power → Win Chance.
- **Tournament / Weekly Tournament**: сетка на выбывание, **best-of-3**,
  ротация класса каждую неделю, награды по финальному месту.
- **Cup** (`AdventuresCup`): Stock Car Cup, раунды Quarter/Semi/Final, рамки-трофеи.
- **Clubs (Guilds)** + **Club Clash**: захват позиций у клуба-соперника,
  3 челленджа/день, best-of-3 на случайном классе, позиции генерируют
  Club Points со временем, защита по таймеру.

### Монетизация / ретеншн
Season Pass (Rookie/Champion/Premium ветки + повторяющаяся награда),
Monthly Passes (30 дней: `Sprint Pass` = 2× скорость гонки, `Idle Gems Pass`,
`Daily Gems Pass` 600→1200 гемов/день), Lucky Draw (ивент с легендаркой),
Collections (альбомы карточек, дубликаты → монеты), Growth Fund,
Chain/Limited/ChooseOne офферы, Daily Rewards с ротацией и майлстоунами,
Gift Codes, Daily/Weekly Tasks, Mailbox, аватары и рамки (`VanityItems`),
`No Ads`, `x2 Resources`, `2x Race Speed`.

## Слой F — вёрстка и числа из кадров

Источники: 6 скриншотов App Store 1284×2778 + 8 официальных видео с канала
`@racestargame`, разложенных на кадры 1 fps, + 100 отзывов Google Play и
App Store RSS. Именно этот слой закрыл дыру со слоем A: **числа взяты с кадров.**

⚠️ Видео опубликованы 17.07.2026 → билд ~1.2–1.3. Гаража на них ещё нет.

### Нижнее меню — 6 вкладок (иконки без подписей)
1. планшет-схема (активная, оранжевая) — **главный экран: гонка + апгрейды**
2. спортивная сумка — снаряжение
3. стопка карточек с фигурой — драйверы
4. кубок — лиги / турниры
5. медаль со звездой — награды
6. вагонетка с камнями — магазин

Содержимое вкладок 2–6 публично нигде не открыто — **нет данных**.

### Главный экран
```
[💵 219M]        Income /s        [💎 8.05K]
[аватар]         $1  [Activate 2x]   [🏎 CLASSES]

ИМЯ КОМАНДЫ (красным)              ┌────────┐
👥 1.55K                           │ P1/10  │
                                   │ 00:15  │
                                   └────────┘
[лента прогресса: 2 ряда в начале, 3 в поздней игре, флажок в конце]
[карта трассы сверху, участники = цветные точки]
[5 круглых кнопок-бустов — только в поздней игре]
[сетка апгрейдов 2×2, скролл]
```

### Тайминги и константы гонки — ПОДТВЕРЖДЕНО КАДРАМИ
- **Гонка = 60 секунд**, таймер идёт на уменьшение (00:59 → 00:00),
  между гонками кулдауна нет
- **Всегда 10 участников**, показывается `P{позиция}/10`
- Гонка **полностью автоматическая**: питстопов, буста, тактики нет.
  Единственное действие игрока — покупать апгрейды прямо во время гонки
- Участники — точки, коллизий нет (подтверждено отзывом)
- Тосты во время гонки: `Your Team takes the lead!`, `Last-Lap Pass!`,
  плашка прироста фанатов `👥 546 ⌃ +205`. По отзывам — **декоративны и
  не синхронизированы с картой**

### Апгрейды главного экрана — цены и шаги С КАДРОВ
Схема одинаковая во всех классах: 2 атакующих + 2 защитных.
Базовые цены **$25 / $50 / $35 / $70**, шаг **+2% / +3% / +2% / +3%** за уровень.

| класс | слот 1 (+2%, $25) | слот 2 (+3%, $50) | слот 3 (+2%, $35) | слот 4 (+3%, $70) |
|---|---|---|---|---|
| Racing | Overtaking Technique | Attacking Moves | Defensive Positioning | Throttle Control |
| Stock Car | Finishing Pace | Attacking Build-Up | Defensive Shape | Car Control |
| Rally | Overtaking Accuracy | Attacking Pressure | Defensive Coverage | Throttle Control |
| Superbike | Overtaking Precision | Attacking Schemes | Defensive Coverage | Grip Security |
| Speedster | Overtake Timing | Attacking Systems | Defensive Block | Car Control |
| Monster Truck | Launch Control | Race Strategy | Cornering Mechanics | Car Control |

Экономическая ветка (общая): **Ticket Marketing** (+$15→+$18, +$27→+$30,
+$46→+$51; цены $33 / $101 / $128 / $466), **Victory Celebrations** (+$0→+$9, $50),
**Parking** (+$0→+$15, +$45→+$60, +$120→+$135),
**Grandstands** (10→15, 45→50, 50→55 — прирост фанатов за гонку, $50).

Трофейная ветка (разблокировка на `0 / 100 trophies earned`):
`Power Launch` и `Clutch Launch`, Lv.0 → `0% → 10%`, тег Offense, цена **1🏆**.

Поздняя игра: Overtaking Accuracy Lv.19 → $31.4K, Attacking Pressure Lv.16 →
$67.2K, Overtaking Technique Lv.8 → $1.21K, Attacking Moves Lv.9 → $6.25K.
→ кривая цены заметно круче линейной, ближе к геометрической.

### Разблокировка классов
Модалка `Choose Your Sport`, сетка 2×3, `3 of 6 unlocked`.
Наблюдённые цены: **`Unlock Superbike $25M`**, **`Unlock New Sport $625M`**.
→ шаг ×25 между разблокировками.

### Лиги и сезоны
Каждый класс ведёт **свой** сезон и свою лигу. Карточка в модалке `Classes`:
```
[иконка] Monster Truck   👥1.01K  🍀28%   [Watch]
Team Name:      [ Your Team        ✏️ ]
Current League: [ ROOKIE LEAGUE    Advance ]
SEASON 028 | SCORE 56 | RANK 3          [Details]
```
Стартовая лига — ROOKIE. Наблюдались SEASON 001, 020, 028 → сезоны короткие.
`Advance` — ручное повышение лиги. Смысл зелёного `🍀%` — **нет данных**.

### Драйверы — числа с кадров
Карточка: имя, **общий рейтинг в круге** (цвет = редкость), `⚔ Offense`,
`🛡 Defense`, `Lv. N`. Третьего стата на карточке нет.

Редкости: `Amateur` (серый) → зелёная → синяя → `All-Star` (фиолетовый) →
`Legend` (золотой) → `Unique` (оранжевый; драйвер «Macks» рейтинг 150 — выше
всех Legend). Названия зелёной и синей — нет данных.

Состав: секция **`STARTERS (5)`** с меткой `PLAYING NOW` → **5 стартовых на класс**.

Тренировка (`Train Driver`) — прирост снят прямо с кадров:
```
(95) Cruz Castro [Legend]
  ⚔ Offense: 96 (+9.6)     🛡 Defense: 93 (+9.3)
  Lv. 1 (+1)   [████████──] 50 / 75 XP
```
1 корм → `0/75 XP`; 2 корма → `50/75`; 5 кормов → `65/100`;
6 кормов → `75/100`, `Lv.1 (+2)`, `Offense: 96 (+19.2)`, `Defense: 93 (+18.6)`.

➡️ **Формула прироста: +10% от базового стата за уровень.**
Проверка: 96 × 0.10 = 9.6 ✓, 96 × 0.20 = 19.2 ✓, 93 × 0.10 = 9.3 ✓.
Порог XP растёт 75 → 100.

### Гача — pity подтверждён
- `PRO PACK`: гарантия All-Star за **15 draws**; x1 = 10💎, x10 = 100💎
- `ALL-STAR PACK`: гарантия Legend за **13 draws**; x1 = 30💎, x10 = 300💎
- Машины — отдельный Lucky Draw за гемы + топовые за **$9.99/шт**

### Экономика — лимиты
- **Gems: жёсткий кап 150/день** из побед (`Gems (47 / 150 per day)`), +1 за победу
- Наблюдённая кривая `Income /s`: $1 → $2 → $4 → $20 → $35 → $45 → $60 → $122
  → $140 → $989 → $1.55K → $2.02K
- Реклама-буст `Activate 2x` **накапливает время**; лимит ~6 реклам на класс
  (36 на все шесть)
- Создание клуба — 150💎
- Season Pass: **сезон ≈ 10 дней** (`9D 19H 11M`), шкала `10 / 35`.
  DAILY (сброс 24 ч): watch ad 1/1, spend gems 30/50, finish race 54/100,
  win race 4/5, finish season 0/1 — по 🪙10.
  WEEKLY (сброс 7 дн): watch ad 1/20, spend gems 30/250, finish race — по 🪙100.

### IAP (App Store, точные цены)
No Ads $9.99 · VIP Fund St.1 $19.99 · Premium Fund St.1 $4.99 · Rookie Pass $4.99 ·
Sprint Pass $4.99 · Double Income Booster $4.99 · Welcome Pack $2.99 ·
Pile of Gems $1.99 · Pile of Rush Gems $1.99 · Player Pack 01-1 $0.99.

### ⚠️ Конфликт слоёв — не разрешён
Слои D+E говорят: исход считает `WinChanceCalculator` от `Team Power`, который
собирается из `Offense`/`Defense`. Слой F (отзыв игрока, ★3): *«winning is
directly correlated with how many in game social media followers you have»* —
позицию определяют **фанаты (👥)**.

Это ровно грабля №9 методики (вывод по одному слою). Вероятная развязка: фанаты —
не отдельный боевой стат, а вход в доход/Team Power, а игрок увидел корреляцию
через общую прокачку. **Проверять симуляцией** (§11), прежде чем закладывать
в баланс. У нас фанаты пойдут в доход, не в исход гонки.

## Сверка (§11 методики) — статус

Таблиц в билде нет, поэтому сверка идёт **целиком через кадры**. Подтверждено:

| число | источник | статус |
|---|---|---|
| длительность гонки 60 с | таймер в кадрах 00:59→00:45 | ✅ |
| 10 участников | `P1/10` в кадрах | ✅ |
| 5 стартовых драйверов | `STARTERS (5)` | ✅ |
| прирост стата +10%/уровень | 96→+9.6, 96→+19.2, 93→+9.3 | ✅ формула сошлась |
| базовые цены апгрейдов $25/$50/$35/$70 | сетка апгрейдов | ✅ |
| шаги +2%/+3% | строки `текущий% → следующий%` | ✅ |
| pity 15 / 13 | текст гача-баннеров | ✅ |
| кап гемов 150/день | `Gems (47 / 150 per day)` | ✅ |
| разблокировка класса $25M → $625M | кнопки Unlock | ✅ |
| кривая цены апгрейда | 4 точки Lv.8/9/16/19 | ⚠️ форма не выведена |
| формула Win Chance | — | ❌ только имя класса |
| офлайн-доход, кап часов | — | ❌ попап нигде не показан |

Незакрытое (`❌`) проектируем сами и помечаем в конфиге как наш баланс.

## Артефакты (в репозитории)

| файл | что |
|---|---|
| `work/names.txt` | 186 232 строки из global-metadata |
| `work/cs_files.txt` | 5632 имени исходников (.cs) |
| `work/monoscripts.json` | 6321 триплет (assembly, namespace, class) |
| `work/mb_class_counts.json` | перепись всех MonoBehaviour в билде |
| `work/loc/en.json` | 1455 строк англ. локализации |
| `work/textassets/` | 18 TextAsset (включая `Field_*` траектории) |
| `work/scan.py`, `dump_scripts.py`, `extract_configs.py` | скрипты разбора |

Сырьё (XAPK и распакованный билд, 1.4 ГБ) — в `raw/`, из git исключено.
