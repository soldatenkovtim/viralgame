import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'
import { trackEvent } from '@/lib/analytics'

const FOCUS_OPTIONS = [
  'Ручной трейдинг',
  'Алготрейдинг',
  'Арбитраж',
  'Quant Research',
  'Другое',
]

export function CareersPage() {
  const [submitted, setSubmitted] = useState(false)
  const [focus, setFocus] = useState(FOCUS_OPTIONS[1])
  const startedRef = useRef(false)

  const handleFirstInput = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('career_form_started', {})
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Прототип ничего никуда не отправляет.
    trackEvent('career_form_submitted', { focus })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-28 sm:px-8 sm:py-36">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-accent/40 bg-violet-dim/30">
          <Check className="h-5 w-5 text-violet-soft" aria-hidden />
        </div>
        <h1 className="text-3xl font-light tracking-[-0.025em] text-chalk-50 sm:text-4xl">
          Готово. В рабочей версии здесь будет отправка контакта команде.
        </h1>
        <p className="text-sm leading-relaxed text-chalk-400">
          Сейчас форма ничего не отправляет — это прототип для проверки сценария.
        </p>
        <LinkButton to="/profile" variant="secondary" className="self-start">
          Вернуться к профилю
        </LinkButton>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-5">
        <SectionLabel>Возможности</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          Хочешь поговорить?
        </h1>
        <p className="text-base leading-relaxed text-chalk-400">
          Расскажи коротко о себе. Мы читаем всё, что приходит, и отвечаем тем, чей
          опыт близок к тому, чем мы занимаемся.
        </p>
      </header>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Field label="Имя">
          <input
            required
            type="text"
            name="name"
            autoComplete="name"
            onChange={handleFirstInput}
            className={inputClass}
          />
        </Field>

        <Field label="Telegram или email">
          <input
            required
            type="text"
            name="contact"
            placeholder="@username или mail@example.com"
            onChange={handleFirstInput}
            className={inputClass}
          />
        </Field>

        <Field label="Чем занимаешься">
          <select
            name="focus"
            value={focus}
            onChange={(event) => {
              handleFirstInput()
              setFocus(event.target.value)
            }}
            className={`${inputClass} appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%236b6b78' stroke-width='1.5'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
            }}
          >
            {FOCUS_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-ink-900">
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Расскажи коротко о своём опыте">
          <textarea
            name="experience"
            rows={5}
            onChange={handleFirstInput}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>

        <div className="flex flex-col gap-5 pt-2">
          <Button type="submit" variant="primary" size="lg" className="self-start">
            Отправить
          </Button>
          <Disclaimer>
            В прототипе форма ничего не отправляет и не сохраняет введённые данные.
          </Disclaimer>
        </div>
      </form>
    </div>
  )
}

const inputClass =
  'min-h-12 w-full rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-chalk-50 placeholder:text-chalk-500 transition-colors focus:border-violet-accent focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="text-sm text-chalk-400">{label}</span>
      {children}
    </label>
  )
}
