import { useEffect, useRef, useState } from 'react'
import { addProtocol, Map as MapLibre, Marker, setWorkerCount, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl'
import mapWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Maximize, Minus, Plus } from 'lucide-react'
import type { MapData } from '../domain/map-data'
import { mapBounds } from '../domain/map-data'
import type { Coordinate } from '../domain/model'
import { t } from '../locales/i18n'
import type { Theme } from '../locales/i18n'
import { assetSources, mapLayers, styleFor } from './map-style'
import type { MapLayer } from './map-style'
import { manifestUrl, openFreeMapRequest, tileAddress, tileTemplate } from './online-policy'

const protocol = 'lifeatlas-tiles'
const network = new Map<string, { template: string; abort: AbortSignal; fail: () => void }>()
setWorkerCount(2)
setWorkerUrl(mapWorker)
addProtocol(protocol, async (request, controller) => {
  const url = new URL(request.url)
  const entry = network.get(url.hostname)
  if (!entry || entry.abort.aborted || url.search || url.hash) throw new Error()
  const signal = AbortSignal.any([controller.signal, entry.abort])
  try {
    const response = await openFreeMapRequest(tileAddress(entry.template, url.pathname), signal)
    if (!response.ok) throw new Error()
    return { data: await response.arrayBuffer(), cacheControl: 'no-store' }
  } catch (error) {
    if (!signal.aborted) entry.fail()
    throw error
  }
})

function fit(map: MapLibre, bounds: MapData['bounds']) {
  if (!bounds) return
  const [west, south, east, north] = bounds
  const clamp = (latitude: number) => Math.max(-85, Math.min(85, latitude))
  map.fitBounds([[west, clamp(south)], [east, clamp(north)]], {
    duration: 0, padding: 45, maxZoom: 15,
  })
}

export default function MapCanvas({ data, visibility, selected, marker, onSelect, online, theme }: {
  data: MapData; visibility: Record<MapLayer, boolean>; selected?: string; marker?: Coordinate
  onSelect?: (id: string) => void; online: boolean; theme: Theme
}) {
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibre>()
  const [problem, setProblem] = useState<'map' | 'online'>()
  const [onlineReady, setOnlineReady] = useState(false)
  const replayMarker = useRef<Marker | null>(null)

  useEffect(() => {
    const target = container.current
    if (!target) return
    const abort = new AbortController()
    const permit = crypto.randomUUID()
    let instance: MapLibre | undefined
    const failOnline = () => {
      if (abort.signal.aborted) return
      abort.abort()
      network.delete(permit)
      setProblem('online')
      setOnlineReady(false)
      instance?.setStyle(styleFor(theme), { diff: false })
    }
    try {
      instance = new MapLibre({
        container: target, style: styleFor(theme), center: [0, 0], zoom: 1.3, attributionControl: false,
        hash: false, dragRotate: false, pitchWithRotate: false, scrollZoom: false, touchPitch: false,
        renderWorldCopies: true, maxPitch: 0,
      })
      const current = instance
      current.on('error', (event) => {
        if (event.error && 'name' in event.error && event.error.name === 'AbortError') return
        if (online && network.has(permit)) failOnline()
        else if (!abort.signal.aborted) setProblem('map')
      })
      current.on('webglcontextlost', () => { setProblem('map'); abort.abort() })
      current.on('style.load', () => {
        setMap(current)
        current.getCanvas().setAttribute('aria-label', t('mapTitle'))
        current.getCanvas().setAttribute('role', 'region')
      })
      if (online) {
        void (async () => {
          try {
            const reply = await openFreeMapRequest(manifestUrl, abort.signal)
            if (!reply.ok) throw new Error()
            const template = tileTemplate(await reply.json())
            if (abort.signal.aborted) return
            network.set(permit, { template, abort: abort.signal, fail: failOnline })
            const tiles = protocol + '://' + permit + '/{z}/{x}/{y}'
            current.setStyle(styleFor(theme, tiles), { diff: false })
            setOnlineReady(true)
          } catch {
            failOnline()
          }
        })()
      }
    } catch {
      setProblem('map')
    }
    return () => {
      abort.abort()
      network.delete(permit)
      instance?.remove()
    }
  }, [online, theme])

  useEffect(() => () => { replayMarker.current?.remove(); replayMarker.current = null }, [map])

  useEffect(() => {
    if (!map || !marker || problem === 'map') {
      replayMarker.current?.remove()
      replayMarker.current = null
      return
    }
    if (!replayMarker.current) {
      const element = document.createElement('div')
      element.className = 'replay-marker'
      element.setAttribute('aria-hidden', 'true')
      replayMarker.current = new Marker({ element, anchor: 'center' }).setLngLat([marker.lon, marker.lat]).addTo(map)
    } else replayMarker.current.setLngLat([marker.lon, marker.lat])
  }, [map, marker, problem])

  useEffect(() => {
    if (!map) return
    const update = () => {
      for (const source of assetSources) map.getSource<GeoJSONSource>(source)?.setData(data[source])
      map.getSource<GeoJSONSource>('density')?.setData({ type: 'FeatureCollection', features: [
        ...data.visits.features, ...data.positions.features, ...data.ends.features, ...data.tracePoints.features,
      ] })
      fit(map, data.bounds)
    }
    update()
    map.on('style.load', update)
    return () => { map.off('style.load', update) }
  }, [data, map])

  useEffect(() => {
    if (!map) return
    const update = () => {
      for (const [name, layers] of Object.entries(mapLayers)) {
        for (const layer of layers) if (map.getLayer(layer)) {
          map.setLayoutProperty(layer, 'visibility', visibility[name as MapLayer] ? 'visible' : 'none')
          if (layer.endsWith('-selected')) map.setFilter(layer, ['==', ['get', 'recordId'], selected ?? ''])
        }
      }
    }
    update()
    map.on('style.load', update)
    return () => { map.off('style.load', update) }
  }, [map, selected, visibility])

  useEffect(() => {
    if (!map || !selected) return
    const points = [data.visits, data.positions, data.ends, data.tracePoints].flatMap((source) => source.features
      .filter((feature) => feature.properties.recordId === selected).map((feature) => feature.geometry.coordinates))
    const lines = data.paths.features.filter((feature) => feature.properties.recordId === selected)
      .flatMap((feature) => feature.geometry.coordinates)
    fit(map, mapBounds([...points, ...lines]))
  }, [data, map, selected])

  useEffect(() => {
    if (!map) return
    map.getCanvas().setAttribute('aria-label', t('mapTitle'))
    const click = (event: MapMouseEvent) => {
      const layers = [...assetSources, 'visits-clusters', 'positions-clusters'].filter((layer) => map.getLayer(layer))
      const item = map.queryRenderedFeatures(event.point, { layers })[0]
      if (!item) return
      if (typeof item.properties.cluster_id === 'number' && item.geometry.type === 'Point') {
        const [longitude, latitude] = item.geometry.coordinates
        if (longitude === undefined || latitude === undefined) return
        void map.getSource<GeoJSONSource>(item.source)?.getClusterExpansionZoom(item.properties.cluster_id)
          .then((zoom) => { map.jumpTo({ center: [longitude, latitude], zoom }) }).catch(() => {})
      } else if (typeof item.properties.recordId === 'string') onSelect?.(item.properties.recordId)
    }
    map.on('click', click)
    return () => { map.off('click', click) }
  }, [map, onSelect])

  return <div className="map-canvas-wrap">
    <div className="map-canvas" ref={container} hidden={problem === 'map'} />
    {map && problem !== 'map' && !onlineReady && <div className="map-grid-overlay" aria-hidden="true" />}
    {!map && !problem && <p className="map-state" role="status">{t('mapLoading')}</p>}
    {problem === 'map' && <p className="map-state" role="status">{t('mapFailed')}</p>}
    {problem === 'online' && <p className="map-notice" role="status">{t('onlineFailed')}</p>}
    {online && !problem && !onlineReady && <p className="map-notice" role="status">{t('onlineLoad')}</p>}
    {map && problem !== 'map' && <div className="map-tools">
      <button className="icon-button" aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => map.zoomIn({ duration: 0 })}><Plus size={17} /></button>
      <button className="icon-button" aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => map.zoomOut({ duration: 0 })}><Minus size={17} /></button>
      <button className="icon-button" aria-label={t('fit')} title={t('fit')} onClick={() => fit(map, data.bounds)}><Maximize size={16} /></button>
    </div>}
    {onlineReady && problem !== 'map' && <div className="map-attribution">
      <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
      <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>}
  </div>
}
