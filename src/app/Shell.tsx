import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Archive, CalendarDays, ChartNoAxesCombined, Database, History, LayoutGrid, Luggage, Map, MapPin, Menu, Moon, PanelLeftClose, PanelLeftOpen, RotateCcw, ShieldCheck, Sun, X } from 'lucide-react'
import type { Selection } from '../features/settings/DataPage'
import { t } from '../locales/i18n'
import type { Preferences } from '../locales/i18n'

const links = [{ route: 'import', Icon: Archive }, { route: 'overview', Icon: LayoutGrid },
  { route: 'explore', Icon: Map }, { route: 'timeline', Icon: History }, { route: 'calendar', Icon: CalendarDays },
  { route: 'analytics', Icon: ChartNoAxesCombined }, { route: 'places', Icon: MapPin }, { route: 'trips', Icon: Luggage },
  { route: 'rewind', Icon: RotateCcw },
  { route: 'data', Icon: Database }] as const
export type Route = typeof links[number]['route']
export function routeFromHash(): Route {
  const route = location.hash.slice(2)
  return links.find((link) => link.route === route)?.route ?? 'import'
}
const selectionLabel = { demo: 'demoArchive', session: 'sessionArchive', persistent: 'savedArchive' }

export function Shell({ route, selection, preferences, online, onNavigate, onPreferences, children }: {
  route: Route; selection: Selection; preferences: Preferences; children: ReactNode; online: boolean
  onNavigate: (next: Route) => void; onPreferences: (next: Preferences) => void
}) {
  const [showNav, setShowNav] = useState(false)
  const [compact, setCompact] = useState(false)
  const ThemeIcon = preferences.theme === 'light' ? Moon : Sun
  const RailIcon = compact ? PanelLeftOpen : PanelLeftClose
  function follow(event: MouseEvent<HTMLAnchorElement>, next: Route) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setShowNav(false)
    onNavigate(next)
  }

  return (
    <div className={compact ? 'shell compact-rail' : 'shell'}
      onKeyDown={(event) => { if (event.key === 'Escape') setShowNav(false) }}>
      <a href="#main-content" className="skip-link" onClick={(event) => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>{t('skip')}</a>
      <aside className="rail">
        <a href="#/import" className="wordmark" aria-label="LifeAtlas" onClick={(event) => follow(event, 'import')}>
          <img src={import.meta.env.BASE_URL + 'atlas-mark.svg'} alt="" width="36" height="36" />
          <span>LifeAtlas</span>
        </a>
        <nav id="primary-navigation" aria-label={t('nav')} className={showNav ? 'nav open-nav' : 'nav'}>
          {links.map(({ route: next, Icon }) => {
            const label = t(next === 'places' ? 'placesNav' : next)
            return (
            <a className="nav-link" href={'#/' + next} key={next} aria-current={route === next ? 'page' : undefined}
              aria-label={label} title={compact ? label : undefined}
              onClick={(event) => follow(event, next)}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </a>
            )
          })}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="top-actions archive-controls">
            <button type="button" className="icon-button menu-button" aria-label={t('menu')}
              aria-controls="primary-navigation" aria-expanded={showNav} onClick={() => setShowNav(!showNav)}>
              {showNav ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button rail-button" title={t('rail')} aria-label={t('rail')}
              aria-pressed={compact} onClick={() => setCompact(!compact)}><RailIcon size={17} aria-hidden="true" /></button>
            <span className={'archive-badge' + (selection === 'demo' ? ' demo-badge' : '')}>
              <span className="status-dot" aria-hidden="true" />
              {t(selection ? selectionLabel[selection] : 'noArchive')}
            </span>
          </div>
          <div className="top-actions">
            <span className="privacy-status"><ShieldCheck aria-hidden="true" size={17} />{t(online ? 'onlineMap' : 'strict')}</span>
            <button type="button" className="icon-button" title={t('theme')} aria-label={t('theme')}
              onClick={() => onPreferences({ ...preferences, theme: preferences.theme === 'light' ? 'dark' : 'light' })}>
              <ThemeIcon size={18} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button language-button" aria-label={t('language')} title={t('language')}
              onClick={() => onPreferences({ ...preferences, language: preferences.language === 'en' ? 'tr' : 'en' })}>
              {preferences.language.toUpperCase()}
            </button>
          </div>
        </header>
        <main className="content" tabIndex={-1} id="main-content">{children}</main>
      </div>
    </div>
  )
}
