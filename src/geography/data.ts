import countryUrl from './atlas-countries.mapdata?url'
import settlementUrl from './atlas-settlements.mapdata?url'
import type { CountryOutlines, SettlementPoint } from '../domain/geography'

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' })
  if (!response.ok || !response.body) throw new Error('Local map data is unavailable')
  const data = response.body.pipeThrough(new DecompressionStream('gzip'))
  return await new Response(data).json() as T
}

let countries: Promise<CountryOutlines> | undefined
export function loadCountries() {
  return countries ??= read<CountryOutlines>(countryUrl).catch((error) => { countries = undefined; throw error })
}

export function loadSettlements() {
  return read<SettlementPoint[]>(settlementUrl)
}
