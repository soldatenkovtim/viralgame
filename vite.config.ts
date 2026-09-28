/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { networkInterfaces } from 'node:os'
import { createRoomService, roomMiddleware } from './server/rooms.ts'

function duelServer(): Plugin {
  return {
    name: 'duel-rooms',
    configureServer(server) {
      const rooms = createRoomService(process.env.DUEL_DB_PATH || '.data/duels.sqlite')
      server.middlewares.use(roomMiddleware(rooms))
      server.middlewares.use('/api/duel-network', (_req, res) => {
        const address = Object.entries(networkInterfaces()).sort(([a], [b]) => Number(!/^(en|eth|wlan)/.test(a)) - Number(!/^(en|eth|wlan)/.test(b))).flatMap(([, entries]) => entries ?? []).find(a => a.family === 'IPv4' && !a.internal)?.address
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ origin: process.env.DUEL_LAN_ORIGIN || (address ? `http://${address}:${server.config.server.port || 5173}` : null) }))
      })
      server.httpServer?.once('close', () => rooms.close())
    },
    configurePreviewServer(server) {
      const rooms = createRoomService(process.env.DUEL_DB_PATH || '.data/duels.sqlite')
      server.middlewares.use(roomMiddleware(rooms))
      server.httpServer.once('close', () => rooms.close())
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), duelServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
