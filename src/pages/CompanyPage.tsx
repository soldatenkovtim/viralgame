import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'

/** Заглушки разделов компании: контент появится в рабочей версии. */
function PlaceholderPage({
  eyebrow,
  title,
  lead,
  blocks,
}: {
  eyebrow: string
  title: string
  lead: string
  blocks: { title: string; text: string }[]
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-12 px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex max-w-3xl flex-col gap-5">
        <SectionLabel>{eyebrow}</SectionLabel>
        <h1 className="text-4xl leading-[1.05] font-light tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-chalk-400">{lead}</p>
      </header>

      <section className="grid gap-10 border-t border-ink-800 pt-12 sm:grid-cols-3">
        {blocks.map((block) => (
          <div key={block.title} className="flex flex-col gap-3">
            <h2 className="text-base font-normal tracking-tight text-chalk-50">
              {block.title}
            </h2>
            <p className="text-sm leading-relaxed text-chalk-400">{block.text}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-5 border-t border-ink-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer>
          Раздел-заглушка прототипа. В рабочей версии здесь будет реальный контент.
        </Disclaimer>
        <LinkButton to="/careers" variant="primary" size="lg">
          Возможности для трейдеров
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
    </div>
  )
}

export function CompanyPage() {
  return (
    <PlaceholderPage
      eyebrow="Компания"
      title="Мы работаем там, где правильный ответ не лежит на поверхности."
      lead="Мы строим системные торговые стратегии и исследуем рыночную микроструктуру. Основная работа — превращать неочевидные наблюдения в воспроизводимый процесс."
      blocks={[
        {
          title: 'Системные стратегии',
          text: 'Мы формализуем торговые идеи, проверяем их на данных и выводим в продакшен с контролем риска на каждом шаге.',
        },
        {
          title: 'Микроструктура',
          text: 'Маркет-мейкинг, поток заявок и исполнение — те же вопросы, что встречаются во втором испытании, только на реальных рынках.',
        },
        {
          title: 'Исследования',
          text: 'Значительная часть работы — это то, что не попадает в отчёт: проверка гипотез, которые не подтвердились.',
        },
      ]}
    />
  )
}

export function TeamPage() {
  return (
    <PlaceholderPage
      eyebrow="Команда"
      title="Трейдеры, исследователи и инженеры в одной команде."
      lead="У нас нет разделения на «тех, кто придумывает» и «тех, кто реализует». Идея, проверка и исполнение живут рядом."
      blocks={[
        {
          title: 'Трейдинг',
          text: 'Ручной и алгоритмический трейдинг, арбитраж, работа с несколькими площадками одновременно.',
        },
        {
          title: 'Quant Research',
          text: 'Статистика, работа с данными и проверка гипотез до того, как стратегия получит реальный риск.',
        },
        {
          title: 'Инфраструктура',
          text: 'Исполнение, мониторинг и всё, без чего стратегия остаётся красивым графиком в тетрадке.',
        },
      ]}
    />
  )
}
