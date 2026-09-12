import Phaser from 'phaser'
import { PAL } from '../config/palette.js'
import { GameState } from '../systems/GameState.js'
import { RaceController } from '../systems/RaceController.js'
import { TopBar } from '../ui/TopBar.js'
import { RacePanel } from '../ui/RacePanel.js'
import { UpgradeGrid } from '../ui/UpgradeGrid.js'
import { BottomNav } from '../ui/BottomNav.js'
import { Toasts } from '../ui/Toasts.js'
import { FinishPopup } from '../ui/FinishPopup.js'
import { InfoPopup } from '../ui/InfoPopup.js'
import { upgradeInfo } from '../ui/upgradeText.js'
import { ClassesModal } from '../ui/ClassesModal.js'
import { DriversModal } from '../ui/drivers/DriversModal.js'
import { CareerModal } from '../ui/career/CareerModal.js'
import { LeaguesModal } from '../ui/leagues/LeaguesModal.js'
import { RewardsModal } from '../ui/rewards/RewardsModal.js'
import { ShopModal } from '../ui/shop/ShopModal.js'
import { GearModal } from '../ui/gear/GearModal.js'
import { GarageModal } from '../ui/garage/GarageModal.js'
import { ObjectiveBar } from '../ui/ObjectiveBar.js'
import { TutorialView } from '../ui/tutorial/TutorialView.js'
import { introInfo } from '../ui/tutorial/introInfo.js'
import { TAB_GATES, tabUnlocked } from '../config/tutorial.js'
import { formatMoney } from '../utils/format.js'
import {
  NAV_H, RACE_Y, RACE_H, GRID_Y, GRID_H, SIDE,
  TOAST_Y, TOAST_STACK, TOAST_MODAL_Y, TOAST_MODAL_STACK,
} from '../config/layout.js'

// Главный экран: гонка идёт непрерывно, апгрейды покупаются прямо во время неё.
// Вся вертикаль (шапка → гонка → полоса тостов → сетка → меню) описана в
// config/layout.js одной цепочкой — здесь только сборка.
export class MainScene extends Phaser.Scene {
  constructor() { super({ key: 'Main' }) }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(PAL.bg)
    this.state = new GameState()

    this.topBar = new TopBar(this, this.state, {
      onBoost: () => this.activateBoost(),
      onClasses: () => this.openClasses(),
      onCareer: () => this.openCareer(),
    })

    this.racePanel = new RacePanel(this, this.state, SIDE, RACE_Y, width - SIDE * 2, RACE_H)
    this.grid = new UpgradeGrid(this, this.state, SIDE, GRID_Y, width - SIDE * 2, GRID_H,
      (key) => this.buy(key), (def) => this.openInfo(def))

    this.toasts = new Toasts(this, width / 2, TOAST_Y)
    this.finish = new FinishPopup(this, width / 2, RACE_Y + RACE_H / 2)
    // Справка по ⓘ. Список под ней запираем: слушатели скролла висят на
    // scene.input, затемнение их не перехватывает, и список ездил бы под
    // открытым окном.
    this.info = new InfoPopup(this, () => { this.grid.locked = !!this.modal?.active })

    this.objective = new ObjectiveBar(this, this.state)

    this.nav = new BottomNav(this, height - NAV_H, width, (i, tab) => {
      // Ворота проверяются ЗДЕСЬ, а не в open*: те же методы дёргает стенд
      // скриншотов и smoke напрямую, и запирать их значило бы запирать
      // проверку экранов вместе с игроком.
      if (!tabUnlocked(this.state, i)) {
        const left = TAB_GATES[i].races - this.state.cls.races
        this.toasts.show(`${tab.title} unlocks in ${left} race${left === 1 ? '' : 's'}`, PAL.muted)
        return
      }
      if (i === 0) { this.nav.setActive(0); return }
      if (i === 1) { this.openGear(); return }
      if (i === 2) { this.openDrivers(); return }
      if (i === 3) { this.openLeagues(); return }
      if (i === 4) { this.openRewards(); return }
      if (i === 5) { this.openShop(); return }
      this.toasts.show(tab.title, PAL.muted)
    })

    this.race = new RaceController(this.state, {
      onEvent: (ev) => this.onRaceEvent(ev),
      onFinish: (res) => this.onRaceFinish(res),
    })

    const offline = this.state.claimOffline()
    if (offline) {
      const mins = Math.round(offline.seconds / 60)
      this.toasts.show(
        `Idle income ${formatMoney(offline.amount)} · ${mins} min` + (offline.capped ? ' (capped)' : ''),
        PAL.greenDim
      )
    }

    // Обучение — последним: оно целится в уже собранные шапку, панель гонки,
    // первую карточку сетки и строку цели.
    this.tutorial = new TutorialView(this, this.state)

    this.uiTimer = 0
    this.refreshUI()
    this.time.addEvent({ delay: 10000, loop: true, callback: () => this.state.save() })
    this.events.once('shutdown', () => this.state.save())
    window.addEventListener('beforeunload', () => this.state.save())
  }

  buy(key) {
    if (!this.state.buy(key)) return
    this.refreshUI()
    this.grid.refresh()
    this.tutorial?.onAction('buy')
  }

  openInfo(def) {
    this.grid.locked = true
    this.info.show(upgradeInfo(def, this.state))
  }

  activateBoost() {
    if (this.state.activateAdBoost()) this.toasts.show('2x income activated!', PAL.accent)
    else this.toasts.show('Boost limit reached for this class', PAL.muted)
    this.refreshUI()
  }

  // Единая обвязка открытия окна. Раньше шесть методов повторяли один и тот же
  // код, и добавить общий шаг (перенос полосы тостов на время окна) означало бы
  // шесть одинаковых правок — то есть пять шансов забыть.
  openModal(Modal, { navIndex = null, intro = null, ...opts } = {}) {
    if (this.modal?.active) return null
    this.grid.locked = true
    if (navIndex !== null) this.nav.setActive(navIndex)
    this.toasts.setAnchor(TOAST_MODAL_Y, TOAST_MODAL_STACK)
    this.modal = new Modal(this, this.state, {
      toast: (text, color) => this.toasts.show(text, color),
      onChange: () => { this.state.save(); this.refreshUI() },
      ...opts,
      onClose: () => {
        this.grid.locked = false
        this.modal = null
        this.toasts.setAnchor(TOAST_Y, TOAST_STACK)
        if (navIndex !== null) this.nav.setActive(0)
        opts.onClose?.()
      },
    })
    // Справка о самом экране — один раз за игру, поверх только что открытого
    // окна. Именно поверх, а не вместо: игрок должен видеть, о чём речь.
    // Обучение кончается на первой минуте, а вкладки открываются на первом
    // часу — без этого каждая новая вкладка снова «непонятно, что тут».
    if (intro && this.state.tutorial.markIntro(intro)) {
      this.state.save()
      this.info.show(introInfo(intro))
    }
    return this.modal
  }

  openClasses() {
    this.openModal(ClassesModal, {
      intro: 'classes',
      onLeagues: (id) => this.openLeagues(id),
      onPick: (id) => {
        this.state.activeClass = id
        this.state.save()
        this.grid.build()
        this.race.start()
        this.refreshUI()
      },
      onUnlock: (id) => {
        const ok = this.state.unlockClass(id)
        this.toasts.show(ok ? 'Class unlocked!' : 'Not enough cash', ok ? PAL.green : PAL.red)
        this.refreshUI()
        return ok
      },
    })
  }

  // Вкладка 2 — гир. Гараж открывается из неё: вкладок в меню ровно шесть [F],
  // а гир и гараж — две части одной работы и делят механику предметов.
  openGear() {
    this.openModal(GearModal, {
      navIndex: 1,
      intro: 'gear',
      onGarage: () => {
        this.modal?.close()
        this.openGarage()
      },
    })
  }

  openGarage() { this.openModal(GarageModal, { navIndex: 1 }) }

  // Отметка `seen` закрывает цель «загляни в драйверов»: у неё нет счётчика,
  // который рос бы сам, — единственное её условие в том, что игрок там был.
  openDrivers() {
    this.state.tutorial.markSeen('drivers')
    this.openModal(DriversModal, { navIndex: 2, intro: 'drivers' })
  }
  openLeagues(classId) { this.openModal(LeaguesModal, { navIndex: 3, classId, intro: 'leagues' }) }
  openRewards() { this.openModal(RewardsModal, { navIndex: 4, intro: 'rewards' }) }
  openShop() { this.openModal(ShopModal, { navIndex: 5, intro: 'shop' }) }
  openCareer() { this.openModal(CareerModal, { intro: 'career' }) }

  onRaceEvent(ev) {
    const color = ev.type === 'lead' ? PAL.red : ev.type === 'lastlap' ? PAL.gold : PAL.accent
    this.toasts.show(ev.text, color)
  }

  onRaceFinish(res) {
    // Итог заезда — в попап, а не в общий поток тостов: там он тонул среди
    // сообщений хода гонки. При открытой модалке попап молчит: он лежит выше
    // окна и накрывал бы таблицу лиги каждые 60 секунд.
    if (!this.modal?.active) this.finish.show(res, this.state.gemsToday)
    this.racePanel.finishFlash(res.position)
    if (res.fans > 0) this.racePanel.popFans(this.state.cls.fans, res.fans)
    if (res.careerLevels > 0) {
      this.toasts.show(`Career Lv. ${this.state.career.level} · +${res.careerLevels} pts`, PAL.cyan)
    }
    if (res.seasonEnded) {
      this.toasts.show(
        res.promoted ? `Promoted! ${this.state.league.name}` : `Season complete · ${this.state.league.name}`,
        res.promoted ? PAL.gold : PAL.purple
      )
    }
    this.refreshUI()
  }

  refreshUI() {
    this.topBar.refresh()
    this.racePanel.refresh(this.race?.sim)
    this.grid.refresh()
    this.objective.refresh()
    // Замки снимаются по ходу игры (ворота считаются от пробега класса),
    // поэтому проверяются здесь, а не один раз при сборке экрана.
    for (const i of Object.keys(TAB_GATES)) this.nav.setLocked(+i, !tabUnlocked(this.state, +i))
    this.nav.setDot(4, this.state.rewardsPending > 0)
    this.nav.setDot(5, this.state.shopPending > 0)
  }

  update(time, delta) {
    this.race.update(delta)
    // dt и alpha идут в панель ТОЛЬКО отсюда: это единственное место, которое
    // вызывается ровно раз в кадр. delta режем сверху — после сворачивания
    // вкладки браузер отдаёт один кадр с delta в несколько секунд, и машины
    // прыгнули бы через пол-трассы.
    this.racePanel.refresh(this.race.sim, {
      alpha: this.race.alpha,
      dt: Math.min(0.05, delta / 1000),
    })

    // Тяжёлый рефреш (цены, доступность кнопок) — 5 раз в секунду.
    this.uiTimer += delta
    if (this.uiTimer >= 200) {
      this.uiTimer = 0
      this.topBar.refresh()
      this.grid.refresh()
      this.objective.refresh()
      this.tutorial.update()
      this.modal?.active && this.modal.refresh()
    }
  }
}