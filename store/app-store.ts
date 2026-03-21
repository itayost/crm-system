import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AppState {
  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void
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
      }),
      {
        name: 'crm-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
        }),
      }
    )
  )
)
