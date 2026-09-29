import { useSearchParams } from 'react-router-dom'

export interface DebugParams {
  enabled: boolean
  /** Принудительный сценарий: blind_02, mm_informed, swan_currency… */
  scenario: string | null
  /** Отключение таймера в «Рыночном шоке». */
  timerDisabled: boolean
}

/** Debug-режим включается флагом ?debug=1 и не влияет на обычное прохождение. */
export function useDebugParams(): DebugParams {
  const [searchParams] = useSearchParams()

  return {
    enabled: searchParams.get('debug') === '1',
    scenario: searchParams.get('debug') === '1' ? searchParams.get('scenario') : null,
    timerDisabled: searchParams.get('timer') === 'off',
  }
}
