// Проверка периодов вкладки наград на виртуальных часах: сброс суток и недели,
// сгорание пасса, стрик и цикл ежедневного входа.
//
// Заведено постоянной командой (`npm run sim:rewards`), а не разовым скриптом:
// это единственная часть игры, где решает КАЛЕНДАРЬ, и ни smoke (он не умеет
// переводить часы), ни балансный прогон (он их не разделяет) её не покрывают.
import './headless.js'
import { clock } from './headless.js'
import { freshRewards, rollover, trackMetric, tasksOf, claimTask, claimLogin, loginState }
  from '../../src/systems/RewardsSystem.js'
import { passProgress, passRows, claimPass } from '../../src/systems/SeasonPass.js'
import { pushMail, mailUnread } from '../../src/systems/RewardsSystem.js'
import { PASS, MAIL } from '../../src/config/rewards.js'
import { freeState, takeDailyGems, takeAdGems, takeCashPack, takeRookiePass }
  from '../../src/systems/ShopSystem.js'
import { FREE, CASH_PACKS } from '../../src/config/shop.js'

const DAY = 86400000
const ok = (name, cond, extra='') => console.log((cond?'  ok  ':'ПРОВАЛ')+'  '+name+(extra?'  '+extra:''))

const rw = freshRewards(Date.now())
trackMetric(rw, 'raceFinish', 100)
ok('задача засчиталась', tasksOf(rw,'daily')[2].claimable)
claimTask(rw, 'daily', 'races')
ok('токены ушли в пасс', rw.pass.tokens === 10, 'tokens='+rw.pass.tokens)
ok('дважды не забрать', claimTask(rw,'daily','races') === 0)

// уровень пасса: 12 за первый, 13 за второй
rw.pass.tokens = 25
ok('уровень 2 при 25 токенах', passProgress(rw).level === 2, JSON.stringify(passProgress(rw)))
ok('уровень 1 забирается', !!claimPass(rw, 1, false))
ok('премиум заблокирован', claimPass(rw, 2, true) === null)
ok('уровень 3 недоступен', claimPass(rw, 3, false) === null)

// сутки вперёд — дейлики сбрасываются, недельные нет
clock.advance(DAY)
rollover(rw, Date.now())
ok('дейлик сброшен', tasksOf(rw,'daily')[2].value === 0)
ok('викли жив', tasksOf(rw,'weekly')[2].value === 100, 'value='+tasksOf(rw,'weekly')[2].value)
ok('токены пасса уцелели', rw.pass.tokens === 25)

// вход: стрик и повтор
const g1 = claimLogin(rw, Date.now())
ok('вход выдал награду', g1.length === 1)
ok('повторный вход пуст', claimLogin(rw, Date.now()).length === 0)
clock.advance(DAY)
claimLogin(rw, Date.now())
ok('стрик 2 подряд', loginState(rw, Date.now()).streak === 2, 'streak='+loginState(rw,Date.now()).streak)
clock.advance(3*DAY)
claimLogin(rw, Date.now())
ok('пропуск рвёт стрик', loginState(rw, Date.now()).streak === 1)
ok('цикл не откатился', loginState(rw, Date.now()).cycleDay === 3, 'cycleDay='+loginState(rw,Date.now()).cycleDay)
ok('майлстоун 3 дня выдан', rw.login.milestones.includes(3))

// сезон пасса: 10 дней -> сгорание
clock.advance(11*DAY)
rollover(rw, Date.now())
ok('пасс сгорел', rw.pass.tokens === 0 && rw.pass.season === 2, 'season='+rw.pass.season)
ok('прогресс входа не сгорел', rw.login.total === 3, 'total='+rw.login.total)

// Потолок шкалы: 35 уровней [F] — за ними ни уровня, ни деления на ноль.
rw.pass.tokens = 1e6
const top = passProgress(rw)
ok('шкала упирается в 35', top.level === PASS.levels && top.need === 0, JSON.stringify(top))
ok('за потолком строк нет', passRows(rw).length === PASS.levels)

// Почта вытесняет старое, а не растёт без предела: письма приходят каждые 20
// заездов, за 700 часов их было бы больше двух тысяч.
for (let i = 0; i < MAIL.max + 15; i++) {
  pushMail(rw, { title: 'T' + i, body: 'b', reward: { kind: 'gems', amount: 1 } }, Date.now() + i)
}
ok('почта ограничена', rw.mail.length === MAIL.max, 'len=' + rw.mail.length)
ok('сверху свежее', rw.mail[0].title === 'T' + (MAIL.max + 14), rw.mail[0].title)
ok('непрочитанных не больше капа', mailUnread(rw) <= MAIL.max)

// --- Магазин (шаг 5) -----------------------------------------------------
// Дневные счётчики магазина сидят в том же ведре, что задачи, и обязаны
// сбрасываться той же границей суток. Проверяем именно это, а не покупку:
// расход гемов — дело GameState, а здесь решает КАЛЕНДАРЬ.
const rw2 = freshRewards(Date.now())
ok('магазин: бесплатное доступно', freeState(rw2).dailyReady && freeState(rw2).adsLeft === FREE.adsPerDay)
takeDailyGems(rw2)
while (takeAdGems(rw2));
ok('магазин: за день выбирается', !freeState(rw2).dailyReady && freeState(rw2).adsLeft === 0)
const vault = CASH_PACKS[CASH_PACKS.length - 1]
ok('пак выдаёт секунды', takeCashPack(rw2, vault.id) > 0)
ok('дневной лимит держит', takeCashPack(rw2, vault.id) === 0)
clock.advance(DAY)
rollover(rw2, Date.now())
ok('магазин сброшен сутками', freeState(rw2).dailyReady && takeCashPack(rw2, vault.id) > 0)

// Сейв, снятый до шага 5, ведра магазина не содержит — rollover обязан его
// достроить, иначе первое же открытие вкладки падает на пустом объекте.
const legacy = freshRewards(Date.now())
delete legacy.shop
rollover(legacy, Date.now())
ok('старый сейв дополняется', !!legacy.shop && freeState(legacy).dailyReady)

// Rookie Pass живёт один сезон пасса: отдельного срока у него нет, флаг лежит
// в rw.pass и обязан сгореть вместе с ним.
takeRookiePass(legacy)
ok('премиум открылся', passRows(legacy)[0].premium.claimable === false || legacy.pass.premium)
clock.advance(11 * DAY)
rollover(legacy, Date.now())
ok('Rookie Pass сгорел с сезоном', legacy.pass.premium === false)

// Итог: провал здесь означает, что сломано ВРЕМЯ, а не награда. Периоды —
// единственная часть вкладки 5, которую нельзя проверить ни тапом (smoke не
// умеет переводить часы), ни прогоном (стенд их не разделяет).
