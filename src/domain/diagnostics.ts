import { limits } from './limits'
import type { Diagnostic, DiagnosticCode, FileReport, ImportReport, IssueCounts } from './model'

export type Warn = (code: DiagnosticCode, amount?: number) => void

export function countIssue(counts: IssueCounts, code: DiagnosticCode, amount = 1): void {
  counts[code] = (counts[code] ?? 0) + amount
}

export class Diagnostics {
  readonly counts: IssueCounts = {}
  readonly examples: Diagnostic[] = []
  readonly files: FileReport[] = []
  duplicates = 0

  at(file: number, record?: number): Warn {
    return (code, amount = 1) => {
      countIssue(this.counts, code, amount)
      const sameCode = this.examples.filter((example) => example.code === code).length
      if (this.examples.length < limits.diagnostics && sameCode < 3) {
        this.examples.push({ code, file, record })
      }
    }
  }

  report(): ImportReport {
    return { files: this.files, counts: this.counts, examples: this.examples, duplicates: this.duplicates }
  }
}
