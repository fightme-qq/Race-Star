import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { OFFERS, IAP_NOTE } from '../../config/shop.js'
import { label } from '../widgets.js'
import { ShopRow, sectionCard, usd, ROW_H, HEAD_H } from './ShopRow.js'
import { timeLeft } from '../rewards/TasksView.js'

// Первая вкладка магазина — то, что и правда можно взять: бесплатные гемы,
// реклама и Rookie Pass. Ниже витрина `Limited Deals` [E] с ценами в долларах:
// она показана и не продаётся (причина — в шапке config/shop.js).
export class DealsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.heads = {
      free: label(scene, 14, 0, 'FREE', { size: 13, bold: true }),
      timer: label(scene, w - 14, 0, '', { size: 11, color: CSS.muted, align: 'right' }),
      pass: label(scene, 14, 0, 'SEASON PASS', { size: 13, bold: true }),
      deals: label(scene, 14, 0, 'LIMITED DEALS', { size: 13, bold: true }),
      note: label(scene, 14, 0, IAP_NOTE, { size: 10, color: CSS.dim }),
    }
    this.add([this.bg, ...Object.values(this.heads)])

    this.daily = new ShopRow(scene, w, () => this.claimDaily())
    this.ad = new ShopRow(scene, w, () => this.watchAd())
    this.pass = new ShopRow(scene, w, () => this.buyPass())
    this.offers = OFFERS.map(() => new ShopRow(scene, w, () => this.toast?.(IAP_NOTE, PAL.muted)))
    this.add([this.daily, this.ad, this.pass, ...this.offers])

    this.boxH = 0
    scene.add.existing(this)
  }

  claimDaily() {
    const gems = this.state.claimDailyGems()
    if (!gems) return
    this.toast?.(`+${gems} 💎`, PAL.cyan)
    this.onChange?.()
  }

  watchAd() {
    const gems = this.state.watchShopAd()
    if (!gems) return
    this.toast?.(`+${gems} 💎`, PAL.cyan)
    this.onChange?.()
  }

  buyPass() {
    if (!this.state.buyRookiePass()) {
      this.toast?.('Not enough Gems', PAL.red)
      return
    }
    this.toast?.('Rookie Pass unlocked — Champion rewards open', PAL.gold)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const free = s.shopFree
    const pass = s.rookiePass
    let y = 0
    this.bg.clear()

    sectionCard(this.bg, y, this.boxW, HEAD_H + ROW_H * 2 + 8)
    this.heads.free.setPosition(14, y + 13)
    this.heads.timer.setPosition(this.boxW - 14, y + 14)
      .setText(`Resets in ${timeLeft(s.resetInSec('daily'))}`)
    this.daily.place(y + HEAD_H, {
      title: 'Free Daily Gems',
      desc: free.dailyReady ? 'Grab them once every day' : 'Come back tomorrow',
      price: free.dailyReady ? `+${free.dailyGems} 💎` : 'Claimed',
      fill: free.dailyReady ? PAL.green : PAL.line,
      enabled: free.dailyReady,
    })
    this.ad.place(y + HEAD_H + ROW_H, {
      title: 'Free Gems',
      desc: `Watch an ad  ·  ${free.adsLeft} / ${free.adsPerDay} left today`,
      price: free.adsLeft ? `+${free.adGems} 💎` : 'Done',
      fill: free.adsLeft ? PAL.green : PAL.line,
      enabled: free.adsLeft > 0,
    })
    y += HEAD_H + ROW_H * 2 + 8 + 12

    sectionCard(this.bg, y, this.boxW, HEAD_H + ROW_H + 8)
    this.heads.pass.setPosition(14, y + 13)
    this.pass.place(y + HEAD_H, {
      title: pass.def.name,
      desc: pass.owned ? 'Champion lane unlocked' : 'Unlocks the Champion lane',
      price: pass.owned ? 'Active' : `${pass.def.gems} 💎`,
      fill: pass.owned ? PAL.line : PAL.gold,
      enabled: !pass.owned && pass.affordable,
    })
    y += HEAD_H + ROW_H + 8 + 12

    sectionCard(this.bg, y, this.boxW, HEAD_H + ROW_H * OFFERS.length + 26)
    this.heads.deals.setPosition(14, y + 13)
    OFFERS.forEach((offer, i) => {
      this.offers[i].place(y + HEAD_H + i * ROW_H, {
        title: offer.name, desc: offer.desc, tag: offer.tag,
        price: usd(offer.usd), fill: PAL.line, enabled: false, dim: true,
      })
    })
    this.heads.note.setPosition(14, y + HEAD_H + ROW_H * OFFERS.length + 4)
    y += HEAD_H + ROW_H * OFFERS.length + 26

    this.boxH = y
  }
}
