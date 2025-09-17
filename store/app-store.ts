import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  read: boolean
  createdAt: Date
}

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
  
  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void
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
        
        // Notifications
        notifications: [],
        addNotification: (notification) =>
          set((state) => ({
            notifications: [
              { 
                ...notification, 
                id: Date.now().toString(),
                createdAt: new Date()
              },
              ...state.notifications,
            ].slice(0, 50) // Keep only last 50 notifications
          })),
        markAsRead: (id) =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          })),
        clearNotifications: () => set({ notifications: [] }),
      }),
      {
        name: 'crm-storage',
        partialize: (state) => ({ 
          notifications: state.notifications,
          sidebarOpen: state.sidebarOpen 
        }),
      }
    )
  )
)