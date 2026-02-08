import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface Timer {
  projectId: string
  taskId?: string
  startTime: Date
}

interface AppState {
  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void

  // Timer State
  activeTimer: Timer | null
  startTimer: (projectId: string, taskId?: string) => void
  stopTimer: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // UI State
        sidebarOpen: true,
        toggleSidebar: () => set((state) => ({
          sidebarOpen: !state.sidebarOpen
        })),

        // Timer State
        activeTimer: null,
        startTimer: (projectId, taskId) =>
          set({
            activeTimer: {
              projectId,
              taskId,
              startTime: new Date()
            }
          }),
        stopTimer: () => set({ activeTimer: null }),
      }),
      {
        name: 'crm-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          activeTimer: state.activeTimer
        }),
      }
    )
  )
)
