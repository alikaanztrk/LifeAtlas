import i18next from 'i18next'
import { en, tr } from './catalog'

export type Language = 'en' | 'tr'
export type Theme = 'light' | 'dark'
export type Units = 'metric' | 'imperial'
export type Preferences = { language: Language; theme: Theme; units: Units; zone: string }
export const timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
const key = 'lifeatlas.preferences'
let units: Units = 'metric'

export function defaults(): Preferences {
  return {
    language: navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    units: 'metric', zone: '',
  }
}

export function readPreferences(): Preferences {
  const fallback = defaults()
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (parsed && typeof parsed === 'object') return {
      language: 'language' in parsed && (parsed.language === 'tr' || parsed.language === 'en')
        ? parsed.language : fallback.language,
      theme: 'theme' in parsed && (parsed.theme === 'dark' || parsed.theme === 'light')
        ? parsed.theme : fallback.theme,
      units: 'units' in parsed && parsed.units === 'imperial' ? 'imperial' : 'metric',
      zone: 'zone' in parsed && typeof parsed.zone === 'string' && timeZones.includes(parsed.zone) ? parsed.zone : '',
    }
  } catch { /* Preferences are optional when storage is blocked. */ }
  return fallback
}

export function savePreferences(value?: Preferences) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch { /* Preferences remain usable in memory. */ }
}

export function applyPreferences(value: Preferences) {
  units = value.units
  document.documentElement.lang = value.language
  document.documentElement.dataset.theme = value.theme
  void i18next.changeLanguage(value.language)
}

export const initialPreferences = readPreferences()

void i18next.init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: initialPreferences.language,
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
})

export const t = (key: string, values: Record<string, unknown> = {}) => i18next.t(key, values)

export function locale() {
  return i18next.language === 'tr' ? 'tr-TR' : 'en-US'
}

export function number(value: number, fraction = 0) {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: fraction }).format(value)
}

export function date(value: number, zone: string) {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: zone }).format(value)
}

export function printDays(first: string, last: string) {
  const format = (day: string) => date(Date.parse(day + 'T12:00:00Z'), 'UTC')
  return first === last ? format(first) : format(first) + ' – ' + format(last)
}

export function timeDuration(ms: number | null) {
  if (ms === null) return t('noMetric')
  if (ms > 0 && ms < 1_000) return '<' + number(1) + ' ' + t('second')
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return number(seconds) + ' ' + t('second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return number(minutes) + ' ' + t('minute')
  const hours = Math.floor(minutes / 60)
  return number(hours) + ' ' + t('oneHour') + (minutes % 60 ? ' ' + number(minutes % 60) + ' ' + t('minute') : '')
}

export function formatDistance(meters: number | null) {
  if (meters === null) return t('noMetric')
  if (units === 'imperial') {
    const short = meters > 0 && meters < 16.09344
    const value = new Intl.NumberFormat(locale(), { style: 'unit', unit: short ? 'foot' : 'mile', maximumFractionDigits: 2 })
    const amount = meters / (short ? .3048 : 1609.344)
    return amount > 0 && amount < .01 ? '<' + value.format(.01) : value.format(amount)
  }
  if (meters > 0 && meters < 10) {
    const value = new Intl.NumberFormat(locale(), { style: 'unit', unit: 'meter', maximumFractionDigits: 2 })
    return meters < .01 ? '<' + value.format(.01) : value.format(meters)
  }
  return new Intl.NumberFormat(locale(), {
    style: 'unit', unit: 'kilometer', maximumFractionDigits: 2,
  }).format(meters / 1000)
}
