import { useEffect, useRef } from 'react'
import { init, use as registerCharts } from 'echarts/core'
import type { ComposeOption } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import type { BarSeriesOption, PieSeriesOption } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ModeTime, PeriodPoint } from '../../domain/exploration'
import { displayDay } from '../../domain/dates'
import { locale, t, timeDuration } from '../../locales/i18n'
import type { Theme } from '../../locales/i18n'

registerCharts([BarChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])
type Options = ComposeOption<BarSeriesOption | PieSeriesOption | GridComponentOption | TooltipComponentOption>
const colors = ['#258473', '#5486ba', '#b67443', '#8265b0', '#267c9a', '#678651', '#c59851', '#c16873']

function Chart({ options, onPoint }: { options: Options; onPoint?: (index: number) => void }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!element.current) return
    const chart = init(element.current, undefined, { renderer: 'canvas' })
    chart.setOption(options)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element.current)
    if (onPoint) chart.on('click', (event) => {
      if (event.componentType === 'series' && Number.isInteger(event.dataIndex)) onPoint(event.dataIndex as number)
    })
    return () => { observer.disconnect(); chart.dispose() }
  }, [options, onPoint])
  return <div className="chart-canvas" ref={element} aria-hidden="true" />
}

function periodLabel(period: PeriodPoint) {
  const label = (day: string) => displayDay(day, locale(), { month: 'short', day: 'numeric', year: 'numeric' })
  return period.first === period.last ? label(period.first) : label(period.first) + ' – ' + label(period.last)
}

export default function Charts({ periods, modes, theme, openCalendar }: {
  periods: PeriodPoint[]; modes: ModeTime[]; theme: Theme; openCalendar: (day: string) => void
}) {
  const color = theme === 'dark' ? '#afc2b7' : '#53645d'
  const grid = theme === 'dark' ? '#394e47' : '#d9e2d8'
  const percent = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 })
  const denominator = modes.reduce((sum, row) => sum + row.ms, 0)
  const short = (period: PeriodPoint) => {
    if (period.first === period.last) return displayDay(period.first, locale(), { month: 'short', day: 'numeric' })
    if (period.first.slice(0, 7) === period.last.slice(0, 7)) {
      return displayDay(period.first, locale(), { month: 'short', year: '2-digit' })
    }
    const start = period.first.slice(0, 4)
    const end = period.last.slice(0, 4)
    return start === end ? start : start + '–' + end
  }
  const movement: Options = {
    animation: false,
    textStyle: { color },
    grid: { top: 22, right: 12, bottom: 36, left: 60 },
    tooltip: { trigger: 'axis', renderMode: 'richText', valueFormatter: (value) =>
      typeof value === 'number' ? timeDuration(value * 60_000) : t('noMetric') },
    xAxis: { type: 'category', data: periods.map(short), axisLabel: { color, hideOverlap: true }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color, formatter: (minutes: number) => timeDuration(minutes * 60_000) },
      splitLine: { lineStyle: { color: grid } } },
    series: [{ type: 'bar', name: t('movementMetric'), data: periods.map((point) => point.movementMs === null ? null : point.movementMs / 60_000),
      itemStyle: { color: theme === 'dark' ? '#91d7bf' : '#267d6a', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 }],
  }
  const transport: Options = {
    animation: false,
    tooltip: { trigger: 'item', renderMode: 'richText', valueFormatter: (value) =>
      typeof value === 'number' ? timeDuration(value) : t('noMetric') },
    series: [{ type: 'pie', radius: ['52%', '79%'], label: { show: false }, labelLine: { show: false },
      data: modes.map((mode, index) => ({ value: mode.ms, name: t('mode.' + mode.mode),
        itemStyle: { color: colors[index % colors.length] } })) }],
  }
  const showMovement = periods.some(({ movementMs }) => movementMs !== null)
  return <div className="insight-grid">
    <section className="panel">
      <h2>{t('movementChart')}</h2>
      {showMovement
        ? <Chart options={movement} onPoint={(index) => { const point = periods[index]; if (point) openCalendar(point.first) }} />
        : <p className="muted chart-empty">{t('noChart')}</p>}
      {periods.length > 0 && <details className="chart-details">
        <summary>{t('chartData')}</summary>
        <table><thead><tr><th>{t('chartPeriod')}</th><th>{t('movementMetric')}</th></tr></thead>
          <tbody>{periods.map((period) => <tr key={period.first}>
            <th scope="row"><button className="button link-button" onClick={() => openCalendar(period.first)}>
              {periodLabel(period)}</button></th><td>{timeDuration(period.movementMs)}</td>
          </tr>)}</tbody></table>
      </details>}
    </section>
    <section className="panel mode-chart">
      <h2>{t('modeChart')}</h2>
      <p className="muted">{t('modeDenominator')}</p>
      {denominator > 0 ? <>
        <Chart options={transport} />
        <dl className="fact-list transport-values">
          {modes.map(({ mode, ms }) => <div key={mode}><dt>{t('mode.' + mode)}</dt>
            <dd>{percent.format(ms / denominator)} · {timeDuration(ms)}</dd></div>)}
        </dl>
      </> : <p className="muted chart-empty">{t('noChart')}</p>}
    </section>
  </div>
}
