# MARKET TRIALS

Браузерный прототип игровой платформы для алготрейдинговой компании.

Три коротких рыночных испытания → персональный профиль поведения в сессии → сравнение с другим трейдером.

Это не образовательная викторина, не казино и не симулятор брокерского терминала. Результат описывает только решения внутри игровой сессии и **не является профессиональной оценкой**.

Весь пользовательский интерфейс на русском языке.

## Запуск

```bash
npm install
npm run dev
```

Откроется `http://localhost:5173`.

Другие команды:

```bash
npm run build      # TypeScript + production-сборка
npm run preview    # просмотр production-сборки
npm test           # scoring-тесты (Vitest)
npm run typecheck  # проверка типов
```

Бэкенд, база и авторизация не нужны. Состояние хранится в `localStorage` через Zustand persist (`market-trials-v1`).

## Как играть

1. Главная → **Начать испытания**
2. **Слепой рынок** — выбрать 2 из 5 блоков информации, принять 3 решения по ходу графика
3. **Маркет-мейкер** — 60 секунд котировать bid/ask против скрытого бота
4. **Рыночный шок** — позиция уже открыта, 3 фазы с таймером 20 секунд
5. **Профиль** — архетип, пять характеристик, карточка 1200×630
6. **Рейтинг** — тестовая таблица, игрок вставляется по лучшему score
7. После каждого испытания можно **отправить этот рынок другому трейдеру**

Полное прохождение: примерно 8–12 минут.

Debug-режим: добавьте `?debug=1` к любому адресу. В панели можно сбросить прогресс, открыть любое испытание, выбрать сценарий / тип бота, выключить таймер, сразу собрать финальный профиль.

## Где менять контент

### Сценарии

| Испытание | Файл | Идентификаторы |
|---|---|---|
| Слепой рынок | `src/data/blindMarketScenarios.ts` | `blind_01`, `blind_02`, `blind_03` |
| Маркет-мейкер | `src/data/marketMakerScenarios.ts` | `mm_noise`, `mm_informed`, `mm_momentum` |
| Рыночный шок | `src/data/blackSwanScenarios.ts` | `swan_energy`, `swan_liquidity`, `swan_currency` |

Свечи и траектория fair value считаются из `seed`. Shared-ссылка передаёт тот же `scenarioId` + `seed`, поэтому второй игрок видит тот же рынок.

Тексты раскрытия («это был энергетический шок»), блоки информации и crowd-статистика тоже живут в этих файлах.

### Scoring

| Что считается | Файл |
|---|---|
| PnL и score Слепого рынка | `src/games/blind-market/scoring.ts` |
| Сделки ботов маркет-мейкера | `src/games/market-maker/bots.ts` |
| Движок котировок | `src/games/market-maker/engine.ts` |
| Score маркет-мейкера | `src/games/market-maker/scoring.ts` |
| PnL и score рыночного шока | `src/games/black-swan/scoring.ts` |
| Trading Profile, архетипы, текст | `src/lib/profile.ts` |
| «Неожиданные факты» | `src/lib/achievements.ts` |
| Игровой score рейтинга | `computeOverallScore` в `src/lib/profile.ts` |

Характеристики профиля приводятся к диапазону 20–95. Score рейтинга — отдельная величина 0–10 000 и не совпадает с профилем.

### Тексты интерфейса

- Главная и карточки испытаний: `src/pages/HomePage.tsx`, `src/components/ui/ChallengeCard.tsx`
- Результаты: `src/games/*/…Result.tsx`
- Профиль и карточка: `src/pages/ProfilePage.tsx`, `src/components/share/ShareCard.tsx`
- Рейтинг (ники и генерация): `src/data/leaderboard.ts`
- Компания / команда / карьера: `src/pages/CompanyPage.tsx`, `src/pages/CareersPage.tsx`
- Shared-ссылки: `src/lib/sharing.ts`, `src/pages/SharedChallengePage.tsx`

Форма на `/careers` ничего никуда не отправляет.

## Маршруты

```
/                                главная
/play                            список испытаний
/challenge/blind-market          слепой рынок
/challenge/market-maker          маркет-мейкер
/challenge/black-swan            рыночный шок
/profile                         профиль сессии
/leaderboard                     рейтинг
/challenge/:id/shared?data=…     тот же сценарий от другого игрока
/company  /team  /careers        заглушки компании
```

## Стек

Vite · React · TypeScript · Tailwind CSS · React Router · Zustand · lightweight-charts · Lucide React · html-to-image · Vitest

Аналитика пока пишется в консоль через `trackEvent` в `src/lib/analytics.ts`.
