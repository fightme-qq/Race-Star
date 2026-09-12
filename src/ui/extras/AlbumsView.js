import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { COLLECTION } from '../../config/extras.js'
import { formatNum } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { ShopRow, sectionCard, ROW_H, HEAD_H } from '../shop/ShopRow.js'
import { AlbumBlock, BLOCK_H } from './AlbumBlock.js'
import { prizeText } from './prize.js'

const HEADER_H = 104
const ULT_H = 86
const GAP = 12

// Коллекции (шаг 9). Попап `Collections Overview` [E] описывает экран целиком:
// сезонное событие, альбомы из карт, паки из игры, дубликаты в Stars, Stars в
// Star Shop, Wild Card открывает недостающую карту, альбом даёт награду, все
// альбомы — Ultimate Reward. Кадра нет ни одного, композиция наша.
//
// Порядок блоков — порядок действий игрока: сперва то, что можно открыть прямо
// сейчас (пак), потом на что потратить Stars, и только потом витрина альбомов.
export class AlbumsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, 14, 12, 'Collections', { size: 16, bold: true })
    this.season = label(scene, w - 14, 15, '', { size: 12, color: CSS.muted, align: 'right' })
    this.purse = label(scene, 14, 38, '', { size: 11, color: CSS.text })
    this.packNote = label(scene, 14, 56, '', { size: 10, color: CSS.dim })
    this.openBtn = new Button(scene, w / 2, 86, w - 32, 28, 'Open Pack', { size: 12, fill: PAL.green })
    this.openBtn.on('press', () => this.openPack())
    this.add([this.bg, this.title, this.season, this.purse, this.packNote, this.openBtn])

    this.starHead = label(scene, 14, 0, 'STAR SHOP', { size: 13, bold: true })
    this.starHint = label(scene, w - 14, 0, '', { size: 11, color: CSS.muted, align: 'right' })
    this.starRows = state.starShop.map((row) =>
      new ShopRow(scene, w, () => this.buyStarPack(row.id)))
    this.add([this.starHead, this.starHint, ...this.starRows])

    this.blocks = Array.from({ length: COLLECTION.albumsPerSeason }, () =>
      new AlbumBlock(scene, 0, w, {
        onClaim: (index) => this.claimAlbum(index),
        onWild: (album, card) => this.useWild(album, card),
      }))
    this.add(this.blocks)

    this.ultHead = label(scene, 14, 0, 'ULTIMATE REWARD', { size: 13, bold: true, color: CSS.gold })
    this.ultNote = label(scene, 14, 0, '', { size: 11, color: CSS.muted })
    this.ultBtn = new Button(scene, w / 2, 0, w - 32, 28, 'Claim', { size: 12, fill: PAL.gold })
    this.ultBtn.on('press', () => this.claimUltimate())
    this.add([this.ultHead, this.ultNote, this.ultBtn])

    this.boxH = 0
    scene.add.existing(this)
  }

  openPack() {
    const got = this.state.openCollectionPack()
    if (!got) { this.toast?.('No packs yet — they come from racing', PAL.muted); return }
    const fresh = got.filter((g) => !g.dup).length
    this.toast?.(`Pack opened · ${got.length} cards, ${fresh} new`, PAL.green)
    this.onChange?.()
  }

  buyStarPack(id) {
    const row = this.state.buyStarPackFor(id)
    if (!row) { this.toast?.('Not enough Stars', PAL.red); return }
    this.toast?.(`${row.name} bought · 1 pack ready`, PAL.gold)
    this.onChange?.()
  }

  claimAlbum(index) {
    const texts = this.state.claimAlbumReward(index)
    if (!texts.length) { this.toast?.('Album reward already claimed', PAL.muted); return }
    this.toast?.('Album complete  ' + texts.join('  '), PAL.gold)
    this.onChange?.()
  }

  useWild(album, card) {
    if (!this.state.useWildCard(album, card)) { this.toast?.('No Wild Cards left', PAL.muted); return }
    this.toast?.('Wild Card used — card unlocked', PAL.cyan)
    this.onChange?.()
  }

  claimUltimate() {
    const texts = this.state.claimUltimateReward()
    if (!texts.length) { this.toast?.('Complete every album first', PAL.muted); return }
    this.toast?.('Ultimate Reward  ' + texts.join('  '), PAL.purple)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const col = s.collectionState
    const albums = s.albums

    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, HEADER_H)
    this.season.setText(`Season ${col.season}`)
    fitText(this.purse.setFontSize(11).setText(
      `⭐ ${formatNum(col.stars)} Stars   ·   🃏 ${col.wild} Wild   ·   ✨ ${col.goldenWild} Golden Wild`
    ), this.boxW - 28)
    const left = Math.max(0, COLLECTION.packEveryRaces - col.raceCount)
    fitText(this.packNote.setFontSize(10).setText(
      `${col.packs} pack${col.packs === 1 ? '' : 's'} ready  ·  next pack in ${left} races`
    ), this.boxW - 28)
    this.openBtn.setText(col.packs > 0 ? `Open Pack  ·  ${col.packs}` : 'No Packs')
    this.openBtn.setEnabled(col.packs > 0)

    let y = HEADER_H + GAP
    const shopH = HEAD_H + ROW_H * this.starRows.length + 12
    sectionCard(this.bg, y, this.boxW, shopH)
    this.starHead.setPosition(14, y + 13)
    this.starHint.setPosition(this.boxW - 14, y + 14)
      .setText(`${formatNum(col.stars)} ⭐`)
    s.starShop.forEach((row, i) => {
      this.starRows[i].setPosition(0, y)
      this.starRows[i].place(HEAD_H + i * ROW_H, {
        title: row.name,
        desc: `${row.cards} cards`,
        price: `Buy  ${row.stars} ⭐`,
        fill: PAL.accent,
        enabled: col.stars >= row.stars,
      })
      // Ценник длиннее, чем «$1.99», а кнопка та же 104px — ужимаем по
      // измеренной ширине (правило 26d о той же кнопке с другой стороны).
      fitText(this.starRows[i].btn.txt.setFontSize(12), 92)
    })
    y += shopH + GAP

    albums.forEach((album, i) => {
      this.blocks[i].setPosition(0, y)
      this.blocks[i].refresh(album, col.wild)
      y += BLOCK_H + GAP
    })

    const done = albums.filter((a) => a.complete).length
    sectionCard(this.bg, y, this.boxW, ULT_H)
    this.ultHead.setPosition(14, y + 12)
    const ult = COLLECTION.ultimateReward.map((r) => prizeText(s, r)).join('  ·  ')
    this.ultNote.setPosition(14, y + 32)
      .setText(`${done} / ${albums.length} albums complete  ·  ${ult}`)
    fitText(this.ultNote.setFontSize(11), this.boxW - 28)
    this.ultBtn.setPosition(this.boxW / 2, y + 66)
    this.ultBtn.setText(col.ultimate ? 'Claimed' : 'Claim')
    this.ultBtn.setEnabled(!col.ultimate && done >= albums.length)
    this.boxH = y + ULT_H
  }
}
