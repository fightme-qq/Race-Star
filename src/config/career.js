// Карьерный драйвер (`CareerPlayers` в оригинале) и его скилл-дерево.
// Механика — [F], дословная цитата из инфо-попапа (teardown/FINDINGS.md, слой E):
//   «Train your Career Driver by playing races in the assigned class. Each race
//    gives Career XP for that class. When your Career Driver gains enough XP,
//    they level up and earn Skill Points. Spend Skill Points to unlock new
//    skills. Skills can improve Offense, Defense, Income, and class-specific
//    bonuses. You can reset your Skills at any time for Gems.»
// Отсюда жёстко следует: XP копится ЗА ГОНКИ В СВОЁМ КЛАССЕ, очки даёт
// уровень, скиллы влияют на Offense / Defense / Income, сброс стоит гемов.
//
// Все ЧИСЛА — [X]: ни одного значения этой системы в кадрах нет.
// В оригинале дерево своё у каждого класса (~11 архетипов x 6 классов).
// У нас набор архетипов общий, а ПРОГРЕСС — на класс (`cls.career`):
// шесть отдельных деревьев с одинаковыми узлами. Разные названия узлов по
// классам — косметика, её добавим, когда будут сняты сами названия.

export const CAREER = {
  xpPerRace: 12,     // [X] базовый XP за заезд
  // [X] XP зависит от места. Иначе карьера растёт ровно по времени и не даёт
  // повода усиливать команду — вторая ветка прогресса стала бы часами на стене.
  xpPlace: [2.0, 1.7, 1.5, 1.3, 1.15, 1.0, 0.9, 0.8, 0.7, 0.6],
  // [X] Порог уровня геометрический. Коэффициенты подобраны так, чтобы Lv.60
  // приходился на конец балансного горизонта (700ч): суммарно ~585K XP при
  // ~840 XP в час. Карьера — длинная ветка, а не разовый буст на первый час.
  xpBase: 45,
  xpGrowth: 1.135,
  maxLevel: 60,
  pointsPerLevel: 1,
  // [X] Карьерный драйвер выходит на трассу ШЕСТЫМ: его статы прибавляются к
  // сумме пятёрки состава. На Lv.1 вклад 8 из 100 — точка калибровки Этапа 1
  // на старте сдвигается меньше чем на 10%.
  baseOff: 8,
  baseDef: 8,
  statPerLevel: 1.5,
  resetGems: 60,     // [X] «reset your Skills at any time for Gems», цена не видна
}

// Ярус открывается по СУММЕ вложенных очков — так дерево остаётся деревом,
// но без рисования связей: игрок всё равно копает вглубь одну ветку.
export const TIER_REQ = [0, 3, 8, 16]   // [X]

// Эффекты. Ключ -> как показывать в карточке.
export const FX_META = {
  careerOff:  { icon: '⚔', unit: '' },
  careerDef:  { icon: '🛡', unit: '' },
  teamOffPct: { icon: '⚔', unit: '%' },
  teamDefPct: { icon: '🛡', unit: '%' },
  defToOff:   { icon: '🛡→⚔', unit: '%' },
  incomePct:  { icon: '💵', unit: '%' },
  prizePct:   { icon: '🏁', unit: '%' },
  fansPct:    { icon: '👥', unit: '%' },
}

// 11 архетипов. Названия `Aggressive Play`, `Glass Cannon`, `Counter Force`,
// `Sponsorships` — [F] из локализации, вместе с их трейд-оффами. Остальные
// семь и все числа — [X].
// Смысл ветки: до неё вся игра сводилась к «покупай что дешевле». Здесь
// впервые появляется РЕШЕНИЕ: суммарно узлов на 86 рангов, а очков к Lv.60
// только 59 — взять всё нельзя, а половина узлов ещё и с минусом.
export const SKILLS = [
  { id: 'racecraft', tier: 0, name: 'Racecraft', max: 10,
    desc: 'Общая наработка: статы карьерного драйвера',
    per: { careerOff: 3, careerDef: 3 } },
  { id: 'sponsorships', tier: 0, name: 'Sponsorships', max: 10,
    desc: 'Спонсоры платят за место в команде',
    per: { incomePct: 4 } },
  { id: 'crowd_work', tier: 0, name: 'Crowd Work', max: 8,
    desc: 'Работа на публику — больше фанатов за заезд',
    per: { fansPct: 6 } },

  { id: 'aggressive', tier: 1, name: 'Aggressive Play', max: 8,
    desc: 'Давить на обгон, жертвуя обороной',
    per: { teamOffPct: 5, teamDefPct: -2 } },
  { id: 'tyre_management', tier: 1, name: 'Tyre Management', max: 8,
    desc: 'Беречь резину: оборона за счёт темпа',
    per: { teamDefPct: 5, teamOffPct: -1.5 } },
  { id: 'prize_hunter', tier: 1, name: 'Prize Hunter', max: 8,
    desc: 'Больше призовых за финиш',
    per: { prizePct: 7 } },

  // Проценты смягчены на Этапе 4. Пока заезд ранжировался по СУММЕ статов,
  // Glass Cannon читался как чистые +30% силы за 6 очков — перекос не стоил
  // ничего. Теперь расклад 75/25 отнимает около четверти очков сезона, и
  // прежние +12/−7 за ранг сделали бы узел миной, а не выбором.
  { id: 'glass_cannon', tier: 2, name: 'Glass Cannon', max: 6,
    desc: 'Всё в атаку, оборона рассыпается',
    per: { teamOffPct: 9, teamDefPct: -4 } },
  // `Counter Force` — [F] из локализации; на Этапе 3 в дерево не вошёл, потому
  // что модель ранжировала по сумме offense+defense и перенос защиты в атаку
  // был тождественной операцией. Прогон подтвердил это буквально: 6 очков в
  // узел стоили −3.6% дохода, ровно как 6 очков в никуда.
  // С разделением заездов на «обгон» и «удержание» узел ожил: часть обороны
  // засчитывается и в атакующем заезде, НЕ покидая оборонительного. Отсюда его
  // роль — не размен, а усилитель ровной сборки: чем больше у команды защиты,
  // тем больше он даёт. Ровно поэтому он и лежит рядом с Glass Cannon, который
  // тянет в противоположную сторону.
  { id: 'counter_force', tier: 2, name: 'Counter Force', max: 6,
    desc: 'Контратака: оборона считается и в атаке',
    per: { defToOff: 5 } },
  // Минус смягчён на Этапе 4 по замеру `node tools/sim/skills.js`: узел был
  // единственным в дереве, который проигрывал ПАЧКЕ, а не только жадному боту.
  // Причина арифметическая: фанаты к финалу дают множитель дохода ×13, поэтому
  // −32% фанатов за 8 рангов съедали собственные +56% дохода.
  { id: 'merchandising', tier: 2, name: 'Merchandising', max: 8,
    desc: 'Мерч приносит деньги, но отпугивает фанатов',
    per: { incomePct: 7, fansPct: -2 } },

  { id: 'veteran', tier: 3, name: 'Veteran Instinct', max: 8,
    desc: 'Опыт ветерана: крупный прирост статов драйверу',
    per: { careerOff: 8, careerDef: 8 } },
  { id: 'team_principal', tier: 3, name: 'Team Principal', max: 6,
    desc: 'Драйвер рулит командой: деньги вместо темпа',
    per: { incomePct: 10, prizePct: 8, teamOffPct: -6 } },
]

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

export const TIER_NAMES = ['НОВИЧОК', 'ГОНЩИК', 'МАСТЕР', 'ЧЕМПИОН']   // [X]
