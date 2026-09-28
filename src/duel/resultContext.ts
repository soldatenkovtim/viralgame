import { createContext, useContext } from 'react'
import type { ResultPayload } from '@/store/gameStore'
export const ResultContext = createContext<ResultPayload | null>(null)
export const useDuelResult = () => useContext(ResultContext)
