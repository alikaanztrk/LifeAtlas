import type { Area } from '../domain/geography'
import { locale, t } from './i18n'

let language = ''
let regions: Intl.DisplayNames
export function countryName(code: string) {
  if (language !== locale()) {
    language = locale()
    regions = new Intl.DisplayNames(language, { type: 'region' })
  }
  return regions.of(code) ?? code
}

export function areaName(area: Area) {
  return area.settlement ? t('nearSettlement', { name: area.settlement.name }) : countryName(area.country)
}

export function placeTitle(name?: string, area?: Area, dayLabel?: string) {
  return name || (area ? areaName(area) : [t('sourceVisit'), dayLabel].filter(Boolean).join(' · '))
}

export function areaDetail(area: Area) {
  return (area.settlement ? areaName(area) + ' · ' : '') + countryName(area.country)
}

export function areaSubtitle(name?: string, area?: Area) {
  if (!area) return
  return name ? areaDetail(area) : area.settlement ? countryName(area.country) : undefined
}
