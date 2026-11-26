import { useEffect, useRef } from 'react'
import { t } from '../locales/i18n'

export type Confirmation = { title: string; description: string; label: string; action: () => void; tone?: 'primary' }

export function ConfirmDialog({ value, onDismiss }: { value: Confirmation; onDismiss: () => void }) {
  const element = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const dialog = element.current
    dialog?.showModal()
    cancel.current?.focus()
    return () => dialog?.close()
  }, [])
  return (
    <dialog ref={element} className="dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"
      onCancel={(event) => { event.preventDefault(); onDismiss() }}>
      <h2 id="confirm-title">{t(value.title)}</h2>
      <p id="confirm-description">{t(value.description)}</p>
      <div className="button-row">
        <button type="button" className="button secondary" ref={cancel} onClick={onDismiss}>{t('cancel')}</button>
        <button type="button" className={'button ' + (value.tone ?? 'danger')} onClick={() => { onDismiss(); value.action() }}>
          {t(value.label)}
        </button>
      </div>
    </dialog>
  )
}
