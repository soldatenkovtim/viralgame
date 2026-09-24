export function ConfidenceSlider({
  value,
  onChange,
  label = 'Насколько ты уверен?',
}: {
  value: number
  onChange: (value: number) => void
  label?: string
}) {
  const fill = ((value - 50) / 50) * 100

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-chalk-400">{label}</span>
        <span className="tnum text-2xl leading-none font-light text-chalk-50">{value}%</span>
      </div>

      {/* Вертикальные отступы дают тач-зону 44px вокруг тонкого трека. */}
      <div className="py-4">
        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="block h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none
            [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950
            [&::-webkit-slider-thumb]:bg-violet-accent
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-violet-accent"
          style={{
            background: `linear-gradient(to right, var(--color-violet-accent) ${fill}%, var(--color-ink-700) ${fill}%)`,
          }}
        />
      </div>

      <div className="tnum -mt-3 flex justify-between text-xs text-chalk-500">
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
