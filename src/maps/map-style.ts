import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, LineString } from 'geojson'
import type { Theme } from '../locales/i18n'

export const assetSources = ['visits', 'positions', 'paths', 'tracePoints', 'ends'] as const
export type MapLayer = Exclude<typeof assetSources[number], 'tracePoints'> | 'heat'
export const mapLayers: Record<MapLayer, string[]> = {
  visits: ['visits', 'visits-clusters', 'visits-selected'],
  positions: ['positions', 'positions-clusters', 'positions-selected'],
  paths: ['paths', 'paths-selected', 'tracePoints', 'tracePoints-selected'], ends: ['ends', 'ends-selected'],
  heat: ['heat-points'],
}

const empty = { type: 'FeatureCollection', features: [] } as const
const lines: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [
    ...Array.from({ length: 23 }, (_, index) => {
      const longitude = (index - 11) * 15
      return [[longitude, -85], [longitude, 85]]
    }),
    ...Array.from({ length: 11 }, (_, index) => {
      const latitude = (index - 5) * 15
      return [[-180, latitude], [0, latitude], [180, latitude]]
    }),
  ].map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
}

type Paint = Extract<LayerSpecification, { type: 'fill' }>['paint']

export function styleFor(theme: Theme, tiles?: string): StyleSpecification {
  const dark = theme === 'dark'
  const background = dark ? '#112b35' : '#dbe8eb'
  const colors = { visits: dark ? '#91ebc5' : '#12644f', positions: dark ? '#9dc8f5' : '#3272a1', ends: dark ? '#ffcf8b' : '#865a25' }
  const selected = dark ? '#fff1aa' : '#842f44'
  const base = (id: string, color: string): LayerSpecification => ({
    id: 'base-' + id, type: 'fill', source: 'basemap', 'source-layer': id,
    paint: { 'fill-color': color } satisfies Paint,
  })
  const layers: LayerSpecification[] = [{ id: 'paper', type: 'background', paint: { 'background-color': background } }]
  if (tiles) layers.push(
    base('landcover', dark ? '#21382e' : '#d5e4d5'),
    base('landuse', dark ? '#293a32' : '#d7ded0'),
    base('water', dark ? '#1a4150' : '#a9ccd8'),
    base('building', dark ? '#46504a' : '#c7c8bb'),
    { id: 'base-boundary', type: 'line', source: 'basemap', 'source-layer': 'boundary', paint: {
      'line-color': dark ? '#697a6f' : '#a1ab9b', 'line-width': 1, 'line-dasharray': [3, 2],
    } },
    { id: 'base-roads', type: 'line', source: 'basemap', 'source-layer': 'transportation', minzoom: 7, paint: {
      'line-color': dark ? '#718675' : '#fffef2', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .5, 17, 2.5],
    } },
  )
  else layers.push(
    { id: 'atlas-land', type: 'fill', source: 'atlas', paint: { 'fill-color': dark ? '#294039' : '#ece9d8' } },
    { id: 'atlas-borders', type: 'line', source: 'atlas', paint: {
      'line-color': dark ? '#61746a' : '#a0aba0', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, .55, 8, 1.25],
    } },
    { id: 'graticule', type: 'line', source: 'grid', paint: {
      'line-color': dark ? '#587478' : '#8ca5a7', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, .48, 7, .12],
    } },
  )
  const points = ['visits', 'positions', 'ends'] as const
  layers.push({
    id: 'heat-points', type: 'heatmap', source: 'density', layout: { visibility: 'none' },
    paint: { 'heatmap-radius': 22, 'heatmap-opacity': .65, 'heatmap-color': ['interpolate', ['linear'],
      ['heatmap-density'], 0, 'rgba(50,160,123,0)', .2, '#63cbab', .6, '#ebc875', 1, '#b64a3d'] },
  })
  layers.push({ id: 'paths', type: 'line', source: 'paths',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'mode'], 'walking', '#22836b', 'cycling', '#487acf',
      'car', '#ae7437', 'rail', '#8266be', 'air', '#237d95', dark ? '#74cfb1' : '#325e56'], 'line-width': 3 } })
  for (const source of points) {
    if (source !== 'ends') layers.push({
      id: source + '-clusters', source, type: 'circle', filter: ['has', 'point_count'],
      paint: {
        'circle-color': colors[source], 'circle-opacity': .78, 'circle-stroke-color': background, 'circle-stroke-width': 2,
        'circle-radius': ['step', ['get', 'point_count'], 12, 12, 17, 80, 24],
      },
    })
    layers.push({
      id: source, source, type: 'circle', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': colors[source], 'circle-radius': source === 'positions' ? 3.5 : 6,
        'circle-stroke-color': background, 'circle-stroke-width': 1.5 },
    })
    layers.push({
      id: source + '-selected', source, type: 'circle', filter: ['==', ['get', 'recordId'], ''],
      paint: { 'circle-color': selected, 'circle-stroke-color': background, 'circle-stroke-width': 2, 'circle-radius': 9 },
    })
  }
  layers.push({ id: 'paths-selected', type: 'line', source: 'paths', filter: ['==', ['get', 'recordId'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': selected, 'line-width': 6 } })
  layers.push({ id: 'tracePoints', type: 'circle', source: 'tracePoints', paint: {
    'circle-color': dark ? '#74cfb1' : '#325e56', 'circle-radius': 4, 'circle-stroke-color': background, 'circle-stroke-width': 1,
  } }, { id: 'tracePoints-selected', type: 'circle', source: 'tracePoints', filter: ['==', ['get', 'recordId'], ''],
    paint: { 'circle-color': selected, 'circle-radius': 8 } })
  return {
    version: 8,
    sources: {
      grid: { type: 'geojson', data: lines },
      ...(!tiles ? { atlas: { type: 'geojson', data: { ...empty, features: [] }, maxzoom: 8, tolerance: .55 } } : {}),
      visits: { type: 'geojson', data: { ...empty, features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 38 },
      positions: { type: 'geojson', data: { ...empty, features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 36 },
      ends: { type: 'geojson', data: { ...empty, features: [] } },
      paths: { type: 'geojson', data: { ...empty, features: [] } },
      tracePoints: { type: 'geojson', data: { ...empty, features: [] } },
      density: { type: 'geojson', data: { ...empty, features: [] } },
      ...(tiles ? { basemap: { type: 'vector', tiles: [tiles], maxzoom: 14 } } : {}),
    },
    layers,
  }
}
