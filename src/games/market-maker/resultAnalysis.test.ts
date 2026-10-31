import { describe, it, expect } from 'vitest'
import { MarketMakerEngine } from './engine'
import { advancedMakerScenarios } from '@/data/advanced/scenarios'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import { financialNumber, roundObservation, phaseComment, phaseReconciliation } from './resultAnalysis'
const base = new MarketMakerEngine(marketMakerScenarios[0]).buildResult()
describe('financial observations', () => {
 it.each([
  [362,-19,391,0,10,'переоценка накопленной позиции'],
  [80,100,0,0,20,'исполнение относительно рынка'],
  [-80,20,-90,0,10,'переоценка накопленной позиции'],
  [-80,20,0,100,0,'хеджирование'],
  [-80,20,0,0,100,'комиссии'],
  [0,100,-90,0,10,'компенсировали'],
 ])('explains %s from components', (pnl,spreadPnl,inventoryPnl,hedgeCosts,transactionCosts,text)=>{
  expect(roundObservation({...base,tradeCount:10,pnl,spreadPnl,inventoryPnl,hedgeCosts,transactionCosts})).toContain(text)
 })
 it('handles absent data and no trades',()=>{
  expect(roundObservation(base)).toContain('не было исполненных')
  expect(roundObservation({...base,tradeCount:1,spreadPnl:NaN})).toContain('недостаточно')
  expect(phaseComment({...base.phases[0],pnlChange:-100,fills:2})).toContain('отрицательный')
  expect(phaseComment({...base.phases[0],pnlChange:100,fills:2})).not.toContain('сохранены')
  expect(phaseComment({...base.phases[0],pnlChange:0,fills:0})).toContain('Исполнений не было')
  expect(phaseReconciliation({...base,phases:[]})).toBe('')
 })
 it('does not adjust the last phase to force a rounded sum',()=>{
  const phases=[100.6,100.6,160.6].map(pnlChange=>({...base.phases[0],pnlChange}))
  const r={...base,pnl:361.8,phases}
  expect(phases.reduce((s,p)=>s+Math.round(p.pnlChange),0)).toBe(363)
  expect(Math.round(r.pnl)).toBe(362)
  expect(phases.map(p=>financialNumber(p.pnlChange))).toEqual(['+100,60','+100,60','+160,60'])
  expect(phaseReconciliation(r)).toBe('')
  expect(financialNumber(-0.001)).toBe('0,00')
 })
 it.each([...marketMakerScenarios, ...advancedMakerScenarios])('checks real scenario $id without trading changes',scenario=>{
  const e=new MarketMakerEngine(scenario); while(!e.finished)e.tick();const r=e.buildResult()
  expect(r.phases.reduce((s,p)=>s+p.pnlChange,0)).toBeCloseTo(r.pnl,7)
  expect(r.spreadPnl+r.inventoryPnl-r.hedgeCosts-(r.transactionCosts??0)-(r.carryCosts??0)).toBeCloseTo(r.pnl,7)
 })
 it('detects hedge fees omitted at a phase boundary without altering the engine',()=>{
  const scenario=marketMakerScenarios.find(s=>s.flowPhases.length>1)!
  const e=new MarketMakerEngine(scenario)
  const boundary=scenario.flowPhases[1].from*2-1
  while(e.snapshot().tick<boundary)e.tick()
  const fee=e.snapshot().hedgeCostPreview
  expect(e.snapshot().inventory).not.toBe(0)
  e.hedge();while(!e.finished)e.tick();const r=e.buildResult()
  expect(r.phases.reduce((s,p)=>s+p.pnlChange,0)-r.pnl).toBeCloseTo(fee)
  expect(phaseReconciliation(r)).toContain('не является полной')
 })
})

it('reproduces the reported 363 versus 362 exactly', () => {
 const e = new MarketMakerEngine(marketMakerScenarios[1]); while (!e.finished) e.tick(); const r=e.buildResult()
 expect(r.pnl).toBe(362)
 expect(r.phases.map(p=>p.pnlChange)).toEqual([317,460.5,-415.5])
 expect(r.phases.reduce((sum,p)=>sum+Math.round(p.pnlChange),0)).toBe(363)
 expect(r.phases.map(p=>financialNumber(p.pnlChange))).toEqual(['+317,00','+460,50','−415,50'])
 expect(roundObservation(r)).toContain('переоценка накопленной позиции (+391,00)')
 expect(roundObservation(r)).toContain('29,00 игровых единиц')
})

it('shows a rounding note only when displayed cents differ', () => {
 const phases=[0.004,0.004,0.004].map(pnlChange=>({...base.phases[0],pnlChange}))
 expect(phaseReconciliation({...base,phases,pnl:0.012})).toContain('округлении')
 expect(phaseReconciliation({...base,phases:[],pnl:0})).toBe('')
})
it('summarizes additional losses naturally', () => {
 expect(roundObservation({...base,tradeCount:19,pnl:-815.5,spreadPnl:-204.5,inventoryPnl:-595,transactionCosts:16,hedgeCosts:0})).toContain('Исполнение относительно рынка и комиссии дополнительно уменьшили результат на 220,50')
})
