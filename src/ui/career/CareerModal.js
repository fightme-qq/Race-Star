import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CAREER, SKILLS, TIER_REQ, TIER_NAMES } from '../../config/career.js'
import {
  careerXpToNext, pointsFree, pointsSpent, careerStats, careerEffects,
} from '../../systems/CareerSystem.js'
import { formatNum } from '../../utils/format.js'
import { panel, label, Button, Bar } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { SkillNode, NODE_H } from './SkillNode.js'
import { OutfitsView } from '../extras/OutfitsView.js'
import { AvatarsView } from '../extras/AvatarsView.js'

const GAP = 8

// Вкладки окна. Аутфиты здесь, а не отдельной модалкой: в оригинале это
// `Career Driver Outfits` [E] — та же сущность, что дерево навыков, и шапка с
// уровнем и статами драйвера над ними общая. Аватар — тоже лицо игрока-драйвера.
const TABS = [
  { key: 'skills', text: 'SKILLS', View: null },
  { key: 'outfits', text: 'OUTFITS', View: OutfitsView },
  { key: 'avatars', text: 'AVATARS', View: AvatarsView },
]

// Скилл-дерево карьерного драйвера. Накладка поверх главного экрана — гонка
// за ней продолжается, как и в модалке драйверов.
export class CareerModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.onChange = onChange
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const bx = 12, by = 96
    const bw = width - 24, bh = height - by - 84

    const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0).setInteractive()
    const box = panel(scene, bx, by, bw, bh, { fill: PAL.panel, radius: 16, stroke: PAL.line })
    const title = label(scene, bx + 14, by + 12, 'CAREER', { size: 16, bold: true })
    this.classText = label(scene, bx + bw - 14, by + 14, '', { size: 12, color: CSS.muted, align: 'right' })

    this.levelText = label(scene, bx + 14, by + 38, '', { size: 13, bold: true, color: CSS.accent })
    this.statsText = label(scene, bx + bw - 14, by + 38, '', { size: 12, align: 'right', color: CSS.cyan })
    this.xpBar = new Bar(scene, bx + 14, by + 60, bw - 28, 6, PAL.accent)
    this.xpText = label(scene, bx + 14, by + 70, '', { size: 10, color: CSS.dim })
    this.pointsText = label(scene, bx + bw - 14, by + 70, '', { size: 11, bold: true, align: 'right' })

    this.add([dim, box, title, this.classText, this.levelText, this.statsText,
      this.xpBar, this.xpText, this.pointsText])

    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((tab, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 100, tw - 6, 26, tab.text, { size: 11 })
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    const cx = bx + 12, cy = by + 120
    const cw = bw - 24, ch = bh - 120 - 50
    this.contentW = cw
    this.scroll = new ScrollView(scene, cx, cy, cw, ch, { fade: PAL.panel })
    this.add(this.scroll)

    this.resetBtn = new Button(scene, bx + bw / 2 - 74, by + bh - 24, 140, 32, '', { fill: PAL.line, size: 11 })
    this.resetBtn.on('press', () => this.resetSkills())
    const close = new Button(scene, bx + bw / 2 + 74, by + bh - 24, 140, 32, 'Close', { fill: PAL.panelAlt, size: 12 })
    close.on('press', () => this.close())
    this.add([this.resetBtn, close])

    // Маска ScrollView режет ПИКСЕЛИ, но не зону нажатия: список добавлен после
    // полосы вкладок и лежит выше неё, поэтому прокрученная вверх строка
    // перехватывала бы тап по вкладке (та же грабля, что в окнах наград и
    // магазина). Панель управления окном поднимаем наверх.
    for (const b of this.tabs) this.bringToTop(b)
    this.bringToTop(this.resetBtn)
    this.bringToTop(close)

    this.setTab(0)
    scene.add.existing(this)
  }

  // Вкладка пересобирается целиком, как в окнах наград и магазина: у дерева
  // десять узлов, у аутфитов шестнадцать строк, и держать оба набора живыми
  // ради переключения означало бы два экрана объектов там, где виден один.
  setTab(index) {
    this.tab = index
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.scroll.clearContent()
    this.nodes = []
    this.view = null
    const { View } = TABS[index]
    if (View) {
      this.view = new View(this.scene, this.state, this.contentW - 12, {
        toast: this.toast,
        onChange: () => { this.onChange?.(); this.refresh() },
      })
      this.view.setPosition(6, 0)
      this.scroll.inner.add(this.view)
    } else {
      this.buildTree(this.scene, this.contentW)
    }
    // Сброс дерева относится только к дереву — на других вкладках кнопки нет.
    this.resetBtn.setVisible(!View)
    this.refresh()
  }

  // Узлы сгруппированы ярусами. Содержимое кладётся в scroll.inner и потому
  // считается ОТ УГЛА СПИСКА, а не от угла экрана (AGENTS.md п.12).
  buildTree(scene, w) {
    this.nodes = []
    let y = 0
    for (let tier = 0; tier < TIER_NAMES.length; tier++) {
      const req = TIER_REQ[tier]
      const head = `${TIER_NAMES[tier]}${req ? `  ·  needs ${req} pts` : ''}`
      this.scroll.inner.add(label(scene, 2, y, head, { size: 11, bold: true, color: CSS.muted }))
      y += 20
      for (const skill of SKILLS.filter((s) => s.tier === tier)) {
        const node = new SkillNode(scene, skill, y, w, (id) => this.spend(id))
        this.scroll.inner.add(node)
        this.nodes.push(node)
        y += NODE_H + GAP
      }
      y += 6
    }
    this.scroll.setContentHeight(y)
  }

  spend(skillId) {
    if (!this.state.spendSkill(skillId)) return
    this.refresh()
    this.onChange?.()
  }

  resetSkills() {
    const back = this.state.resetCareerSkills()
    if (!back) {
      this.toast?.(`Need ${CAREER.resetGems} 💎 and spent points`, PAL.dim)
      return
    }
    this.toast?.(`Tree reset · +${back} pts`, PAL.purple)
    this.refresh()
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const career = s.career
    const fx = careerEffects(career)
    const stats = careerStats(career, fx)
    const free = pointsFree(career)
    const toNext = careerXpToNext(career.level)

    this.classText.setText(s.clsDef.icon + ' ' + s.clsDef.name)
    this.levelText.setText(career.level >= CAREER.maxLevel
      ? `Lv. ${career.level} · MAX`
      : `Lv. ${career.level}`)
    this.statsText.setText(`⚔ ${Math.round(stats.off)}   🛡 ${Math.round(stats.def)}`)
    this.xpBar.setValue(toNext === Infinity ? 1 : career.xp / toNext)
    this.xpText.setText(toNext === Infinity
      ? 'Max level'
      : `XP ${formatNum(career.xp)} / ${formatNum(toNext)}`)
    this.pointsText.setText(free > 0 ? `${free} pts free` : `${pointsSpent(career)} pts spent`)
    this.pointsText.setColor(free > 0 ? CSS.accent : CSS.dim)

    for (const node of this.nodes) node.refresh(career)
    if (this.view?.active) {
      this.view.refresh()
      this.scroll.setContentHeight(this.view.boxH)
    }

    this.resetBtn.setText(`Reset · ${CAREER.resetGems} 💎`)
    this.resetBtn.setEnabled(s.canResetSkills())
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }

  destroy(fromScene) {
    this.scroll?.destroy(fromScene)
    super.destroy(fromScene)
  }
}
