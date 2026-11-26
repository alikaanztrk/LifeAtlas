import { ChevronDown } from 'lucide-react'
import type { ImportReport, IssueCounts } from '../domain/model'
import { number, t } from '../locales/i18n'

export function Issues({ counts }: { counts: IssueCounts }) {
  const entries = Object.entries(counts)
  if (!entries.length) return <p className="muted">{t('noIssues')}</p>
  return (
    <dl className="fact-list">
      {entries.map(([code, count]) => (
        <div key={code}><dt>{t('issue.' + code)}</dt><dd>{number(count)}</dd></div>
      ))}
    </dl>
  )
}

function fileSize(bytes: number) {
  if (bytes < 1024) return number(bytes) + ' B'
  if (bytes < 1_048_576) return number(bytes / 1024, 2) + ' KiB'
  return number(bytes / 1_048_576, 2) + ' MiB'
}

export function FileReports({ report }: { report: ImportReport }) {
  return (
    <ul className="file-list">
      {report.files.map((file) => (
        <li key={file.slot}>
          <div className="file-header">
            <strong>{t('fileLabel', { slot: file.slot })}</strong>
            <span>{fileSize(file.bytes)}</span>
          </div>
          {file.format && <span>{t('format.' + file.format)}</span>}
          {file.failure && <span className="warning-text">{t('issue.' + file.failure)}</span>}
          {(file.format || file.input > 0) && <dl className="file-counts">
            <div><dt>{t('input')}</dt><dd>{number(file.input)}</dd></div>
            <div><dt>{t('accepted')}</dt><dd>{number(file.accepted)}</dd></div>
            <div><dt>{t('skipped')}</dt><dd>{number(file.skipped)}</dd></div>
          </dl>}
        </li>
      ))}
    </ul>
  )
}

export function DiagnosticDetails({ report }: { report: ImportReport }) {
  return (
    <details className="diagnostics">
      <summary>{t('checkDetails')}<ChevronDown aria-hidden="true" size={16} /></summary>
      <p className="muted">{t('diagnosticHint')}</p>
      <Issues counts={report.counts} />
      {report.examples.length > 0 && <ul className="examples">
        {report.examples.map((item, index) => (
          <li key={index}>
            <span>{item.record === undefined
              ? t('fileOnly', { file: item.file }) : t('fileExample', { file: item.file, row: item.record })}</span>
            <span>{t('issue.' + item.code)}</span>
          </li>
        ))}
      </ul>}
    </details>
  )
}
