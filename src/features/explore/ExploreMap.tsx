import type { Theme } from '../../locales/i18n'
import { locale, t } from '../../locales/i18n'
import { displayDay } from '../../domain/dates'
import { modes } from '../../domain/exploration'
import type { MapData } from '../../domain/map-data'
import type { Mode } from '../../domain/model'
import type { Coordinate } from '../../domain/model'
import type { Replay } from '../../domain/replay'
import { MapPanel } from './MapPanel'
import { ReplayPlayer } from './ReplayPlayer'

export function ExploreMap({ map, theme, online, onOnline, selected, onSelect, mode, onMode, day, onClear, openDay,
  replay, replayOpen, onReplay, zone }: {
  map?: MapData; theme: Theme; online: boolean; onOnline: () => void;
  selected?: string; onSelect: (id: string) => void; mode?: Mode; onMode: (mode?: Mode) => void;
  day?: string; onClear: () => void; openDay: (day: string, id: string) => void
  replay?: Replay; replayOpen: boolean; onReplay: () => void; zone: string
}) {
  const mapWith = (marker?: Coordinate) => map && <MapPanel data={map} theme={theme} online={online && !replayOpen}
    selected={selected} marker={marker} onSelect={onSelect} onOpenDay={openDay} />
  return <>
    <header className="page-heading overview-heading">
      <div><h1>{t('explore')}</h1><p>{t('mapDescription')}</p></div>
      <div className="button-row">
        <button className="button secondary" aria-expanded={replayOpen} onClick={onReplay}>{t(replayOpen ? 'replayClose' : 'replayOpen')}</button>
        {!replayOpen && <button className="button secondary" onClick={onOnline}>{t(online ? 'onlineOff' : 'onlineOn')}</button>}
      </div>
    </header>
    {day && <div className="notice map-day-notice">
      <span>{t('dayScope')} · {displayDay(day, locale(), { dateStyle: 'long' })}</span>
      <button className="button link-button" onClick={onClear}>{t('clearDay')}</button>
    </div>}
    <section className="panel explore-map-panel">
      <div className="view-toolbar">
        <label className="compact-field">{t('movementFilter')}
          <select value={mode ?? ''} onChange={(event) => onMode(modes.find((value) => value === event.target.value))}>
            <option value="">{t('allModes')}</option>
            {modes.map((item) => <option key={item} value={item}>{t('mode.' + item)}</option>)}
          </select>
        </label>
      </div>
      {!map && <p className="notice" role="status">{t('loadingView')}</p>}
      {map && replayOpen && replay?.kind !== 'ready' && <p className="notice" role="status">
        {t(replay?.kind === 'limit' ? 'replayLimit' : 'replayEmpty')}
      </p>}
      {map && replayOpen && replay?.kind === 'ready'
        ? <ReplayPlayer replay={replay} zone={zone}>{mapWith}</ReplayPlayer>
        : mapWith()}
    </section>
  </>
}
