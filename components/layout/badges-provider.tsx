'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import api from '@/lib/api/client'
import type { TodayBadges } from '@/lib/services/today.service'

const EMPTY: TodayBadges = {
  triageRequests: 0,
  dueTasks: 0,
  dueLeads: 0,
  outstanding: 0,
  botPaused: false,
}

const BadgesContext = createContext<TodayBadges>(EMPTY)

export function useBadges() {
  return useContext(BadgesContext)
}

/**
 * One request feeds every badge in the shell.
 *
 * Refreshed on route change and on a slow interval. That interval is roughly
 * the budget the header previously spent re-rendering a live clock every sixty
 * seconds, which nobody read.
 */
export function BadgesProvider({ children }: { children: React.ReactNode }) {
  const [badges, setBadges] = useState<TodayBadges>(EMPTY)
  const pathname = usePathname()

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/today')
      setBadges(data)
    } catch {
      // A failed badge fetch must never take the shell down with it. No count
      // is a worse answer than a wrong count, and both beat a blank page.
      setBadges(EMPTY)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  useEffect(() => {
    const timer = setInterval(refresh, 120_000)
    return () => clearInterval(timer)
  }, [refresh])

  return <BadgesContext.Provider value={badges}>{children}</BadgesContext.Provider>
}
