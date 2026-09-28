import type { RoomView } from './roomTypes'
const rank = { invited: 0, ready: 1, playing: 2, finished: 3 }
/** A poll begun before an action must not roll the UI back when it arrives later. */
export function mergeRoom(previous: RoomView | null, next: RoomView): RoomView {
  if (!previous || previous.id !== next.id) return next
  return { ...next, role: next.role ?? previous.role,
    host: rank[previous.host] > rank[next.host] ? previous.host : next.host,
    guest: rank[previous.guest] > rank[next.guest] ? previous.guest : next.guest,
    results: next.results ?? previous.results }
}
