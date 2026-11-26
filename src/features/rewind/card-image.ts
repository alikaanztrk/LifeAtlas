import { cardDimensions } from '../../domain/share-card'
import type { ShareLayout } from '../../domain/share-card'

export type CardImage = {
  title: string; edition?: string; status?: string; footer: string;
  metrics: { title: string; value: string; detail?: string }[]
}

export function drawCard(canvas: HTMLCanvasElement, layout: ShareLayout, image: CardImage): boolean {
  const { width, height } = cardDimensions[layout]
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.fillStyle = '#10372f'
  ctx.fillRect(0, 0, width, height)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#7edaad36'
  for (let ring = 0; ring < 12; ring++) {
    ctx.beginPath()
    ctx.ellipse(width - 128, 137, 54 + ring * 31, 27 + ring * 22, -.53, 0, 2 * Math.PI)
    ctx.stroke()
  }
  const text = (value: string, x: number, y: number, font: string, color: string, max: number) => {
    ctx.fillStyle = color
    ctx.font = font
    ctx.fillText(value, x, y, max)
  }
  const mint = '#a3dfbd'
  const paper = '#f2f9ed'
  const pad = 78
  const available = width - 2 * pad
  text('LifeAtlas', pad, 115, '700 38px system-ui', mint, available)
  text(image.title, pad, 232, '76px Georgia', paper, available)
  if (image.edition) text(image.edition, pad, 298, '500 39px system-ui', paper, available)
  if (image.status) text(image.status, pad, 351, '500 29px system-ui', '#f5ce86', available)

  const columns = layout === 'portrait' ? 1 : 2
  const rows = Math.ceil(image.metrics.length / columns)
  const space = Math.min(layout === 'portrait' ? 304 : 238, (height - 535) / Math.max(1, rows))
  const columnWidth = available / columns
  for (const [index, metric] of image.metrics.entries()) {
    const left = pad + index % columns * columnWidth
    const top = 420 + Math.floor(index / columns) * space
    const wrap = columnWidth - 24
    ctx.fillStyle = '#225145'
    ctx.beginPath()
    ctx.roundRect(left, top - 20, wrap, Math.max(117, space - 24), 17)
    ctx.fill()
    text(metric.title, left + 25, top + 27, '650 27px system-ui', mint, wrap - 50)
    text(metric.value, left + 25, top + (space < 160 ? 81 : 99), space < 160 ? '50px Georgia' : '65px Georgia', paper, wrap - 50)
    if (metric.detail) text(metric.detail, left + 25, top + (space < 160 ? 108 : 148), '500 20px system-ui', paper, wrap - 50)
  }
  text(image.footer, pad, height - 50, '500 25px system-ui', mint, available)
  return true
}
