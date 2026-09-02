import Phaser from 'phaser'
import { PAL } from '../config/palette.js'
import { GameState } from '../systems/GameState.js'
import { RaceController } from '../systems/RaceController.js'
import { TopBar, HEADER_H } from '../ui/TopBar.js'
import { RacePanel } from '../ui/RacePanel.js'
import { UpgradeGrid } from '../ui/UpgradeGrid.js'
import { BottomNav } from '../ui/BottomNav.js'
import { Toasts } from '../ui/Toasts.js'
import { FinishPopup } from '../ui/FinishPopup.js'
import { ClassesModal } from '../ui/ClassesModal.js'
import { DriversModal } from '../ui/drivers/DriversModal.js'
import { CareerModal } from '../ui/career/CareerModal.js'
import { formatMoney } from '../utils/format.js'

const NAV_H = 70
const RACE_H = 306

// Главный экран: гонка идёт непрерывно, апгрейды покупаются прямо во время неё.
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

    const raceY = HEADER_H + 8
    this.racePanel = new RacePanel(this, this.state, 10, raceY, width - 20, RACE_H)

    const gridY = raceY + RACE_H + 12
    this.grid = new UpgradeGrid(this, this.state, 10, gridY, width - 20, height - NAV_H - gridY - 8,
      (key) => this.buy(key))

    this.toasts = new Toasts(this, width / 2, raceY + 128)
    this.finish = new FinishPopup(this, width / 2, raceY + RACE_H / 2)

    this.nav = new BottomNav(this, height - NAV_H, width, (i, tab) => {
      if (i === 0) { this.nav.setActive(0); return }
      if (i === 2) { this.openDrivers(); return }
      this.toasts.show(tab.title + ' — coming in a later stage', PAL.muted)
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

  openClasses() {
    if (this.modal?.active) return
    this.grid.locked = true
    this.modal = new ClassesModal(this, this.state, {
      toast: (text, color) => this.toasts.show(text, color),
      onClose: () => { this.grid.locked = false; this.modal = null },
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

  openDrivers() {
    if (this.modal?.active) return
    this.grid.locked = true
    this.nav.setActive(2)
    this.modal = new DriversModal(this, this.state, {
      toast: (text, color) => this.toasts.show(text, color),
      onChange: () => { this.state.save(); this.refreshUI() },
      onClose: () => { this.grid.locked = false; this.modal = null; this.nav.setActive(0) },
    })
  }

  openCareer() {
    if (this.modal?.active) return
    this.grid.locked = true
    this.modal = new CareerModal(this, this.state, {
      toast: (text, color) => this.toasts.show(text, color),
      onChange: () => { this.state.save(); this.refreshUI() },
      onClose: () => { this.grid.locked = false; this.modal = null },
    })
  }

  onRaceEvent(ev) {
    const color = ev.type === 'lead' ? PAL.red : ev.type === 'lastlap' ? PAL.gold : PAL.accent
    this.toasts.show(ev.text, color)
  }

  onRaceFinish(res) {
    // Итог заезда — в попап, а не в общий поток тостов: там он тонул среди
    // сообщений хода гонки. В оригинале это отдельное окно поверх карты.
    this.finish.show(res, this.state.gemsToday)
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
  }

  update(time, delta) {
    this.race.update(delta)
    this.racePanel.refresh(this.race.sim)

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
