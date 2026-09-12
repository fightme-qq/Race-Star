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
import { ClassesModal } from '../ui/ClassesModal.js'
import { DriversModal } from '../ui/drivers/DriversModal.js'
import { CareerModal } from '../ui/career/CareerModal.js'
import { LeaguesModal } from '../ui/leagues/LeaguesModal.js'
import { RewardsModal } from '../ui/rewards/RewardsModal.js'
import { ShopModal } from '../ui/shop/ShopModal.js'
import { GearModal } from '../ui/gear/GearModal.js'
import { GarageModal } from '../ui/garage/GarageModal.js'
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
      (key) => this.buy(key))

    this.toasts = new Toasts(this, width / 2, TOAST_Y)
    this.finish = new FinishPopup(this, width / 2, RACE_Y + RACE_H / 2)

    this.nav = new BottomNav(this, height - NAV_H, width, (i, tab) => {
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
  }

  activateBoost() {
    if (this.state.activateAdBoost()) this.toasts.show('2x income activated!', PAL.accent)
    else this.toasts.show('Boost limit reached for this class', PAL.muted)
    this.refreshUI()
  }

  // Единая обвязка открытия окна. Раньше шесть методов повторяли один и тот же
  // код, и добавить общий шаг (перенос полосы тостов на время окна) означало бы
  // шесть одинаковых правок — то есть пять шансов забыть.
  openModal(Modal, { navIndex = null, ...opts } = {}) {
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
    return this.modal
  }

  openClasses() {
    this.openModal(ClassesModal, {
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
      onGarage: () => {
        this.modal?.close()
        this.openGarage()
      },
    })
  }

  openGarage() { this.openModal(GarageModal, { navIndex: 1 }) }

  openDrivers() { this.openModal(DriversModal, { navIndex: 2 }) }
  openLeagues(classId) { this.openModal(LeaguesModal, { navIndex: 3, classId }) }
  openRewards() { this.openModal(RewardsModal, { navIndex: 4 }) }
  openShop() { this.openModal(ShopModal, { navIndex: 5 }) }
  openCareer() { this.openModal(CareerModal) }

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
      this.modal?.active && this.modal.refresh()
    }
  }
}