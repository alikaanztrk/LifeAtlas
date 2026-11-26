import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Layers3, MapPin } from 'lucide-react'
import { displayDay } from '../../domain/dates'
import type { MapData, MapRow } from '../../domain/map-data'
import type { Coordinate } from '../../domain/model'
import type { MapLayer } from '../../maps/map-style'
import { locale, number, t } from '../../locales/i18n'
import type { Theme } from '../../locales/i18n'
import { areaSubtitle, areaName } from '../../locales/geography'

const MapCanvas = lazy(() => import('../../maps/MapCanvas'))
const layerLabels: Record<MapLayer, string> = {
  visits: 'layerVisits', paths: 'layerPaths', positions: 'layerRaw', ends: 'layerEnds', heat: 'layerHeat',
}
const layerDefaults = { visits: true, paths: true, positions: true, ends: true, heat: false }
const layersForRow = { visit: 'visits', activity: 'ends', raw: 'positions', path: 'paths' } as const
const names = { visit: 'sourceVisit', activity: 'sourceActivity', path: 'sourcePath', raw: 'sourceRaw' }

export function mapRowName(row: MapRow) {
  return row.label || (row.area ? areaName(row.area)
    : row.mode && row.kind === 'activity' ? t('mode.' + row.mode) : t(names[row.kind]))
}

export function MapPanel({ data, theme, online = false, simple = false, defer = false, selected, marker, onSelect, onOpenDay }: {
  data: MapData; theme: Theme; online?: boolean; simple?: boolean; defer?: boolean
  selected?: string; marker?: Coordinate; onSelect?: (id: string) => void; onOpenDay?: (day: string, record: string) => void
}) {
  const [show, setShow] = useState(!defer)
  const [visibility, setVisibility] = useState(layerDefaults)
  const [page, setPage] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (show || !box.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setShow(true)
    }, { rootMargin: '120px' })
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [show])

  const active = data.rows.find((row) => row.id === selected)
  const context = areaSubtitle(active?.label, active?.area)
  const rows = data.rows.filter((row) => visibility[layersForRow[row.kind]])
  const pathModes = new Set(data.paths.features.map((feature) => feature.properties.mode))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1))
  return <div className={'map-panel' + (simple ? ' mini-map' : '')} ref={box}>
    {!simple && <fieldset className="map-layer-toggle">
      <legend><Layers3 size={15} aria-hidden="true" /> {t('mapLayers')}</legend>
      {Object.entries(layerLabels).map(([name, label]) => {
        const key = name as MapLayer
        return <label key={name}><input type="checkbox" checked={visibility[key]}
          onChange={(event) => setVisibility((previous) => ({ ...previous, [key]: event.target.checked }))} />{t(label)}</label>
      })}
    </fieldset>}
    <div className="map-matte">
      {data.bounds && show ? <Suspense fallback={<p className="map-state" role="status">{t('mapLoading')}</p>}>
        <MapCanvas key={theme + online} data={data} visibility={visibility} theme={theme}
          online={online} selected={selected} marker={marker} onSelect={onSelect} />
      </Suspense> : !data.bounds ? <p className="map-state"><MapPin size={21} aria-hidden="true" />{t('noLocations')}</p> : null}
    </div>
    <div className="map-caption"><span><span>{t(online ? 'onlineMap' : 'localMap')}</span>
      {!online && <> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a></>}
    </span><span>{t('mapCount', { count: number(data.mapped) })}</span></div>
    {!simple && visibility.paths && pathModes.size > 0 && <ul className="path-colors" aria-label={t('pathColors')}>
      {Array.from(pathModes, (mode) => <li key={mode}><i className={'path-color path-' + mode} aria-hidden="true" />{t('mode.' + mode)}</li>)}
    </ul>}
    {data.omitted > 0 && <p className="muted map-sampling">{t('mapSample')}</p>}
    {!simple && active && <div className="map-selection">
      <div><strong>{mapRowName(active)}</strong>
        {context && <p className="muted">{context}</p>}
        <p className="muted">{active.day ? displayDay(active.day, locale(), { dateStyle: 'full' }) : t('noDateForRecord')}</p></div>
      {active.day && onOpenDay && <button className="button primary" onClick={() => onOpenDay(active.day!, active.id)}>{t('openDay')}</button>}
    </div>}
    {!simple && rows.length > 0 && <details className="map-records">
      <summary>{t('mapRecords')}</summary>
      <ul className="map-record-list">
        {rows.slice(currentPage * 12, (currentPage + 1) * 12).map((row) => <li key={row.id}>
          <button className="button secondary" aria-pressed={row.id === selected} onClick={() => onSelect?.(row.id)}>
            <span>{mapRowName(row)}</span>
            {row.day && <small>{displayDay(row.day, locale(), { dateStyle: 'medium' })}</small>}
          </button>
        </li>)}
      </ul>
      {rows.length > 12 && <div className="button-row">
        <button className="button secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('previousPeriod')}</button>
        <button className="button secondary" disabled={(currentPage + 1) * 12 >= rows.length} onClick={() => setPage(currentPage + 1)}>{t('nextPeriod')}</button>
      </div>}
    </details>}
  </div>
}
