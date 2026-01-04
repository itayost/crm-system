'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Square, Clock } from 'lucide-react'
import api from '@/lib/api/client'

interface ActiveTimer {
  id: string
  startTime: string
  task: {
    id: string
    title: string
  }
  project: {
    id: string
    name: string
  }
}

export function TimerWidget() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch active timer on mount
  useEffect(() => {
    fetchActiveTimer()
  }, [])

  // Update elapsed time every second
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime()
        const now = Date.now()
        setElapsed(Math.floor((now - start) / 1000))
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [activeTimer])

  const fetchActiveTimer = async () => {
    try {
      setLoading(true)
      const response = await api.get('/time/active')
      setActiveTimer(response.data)
    } catch (error) {
      console.error('Error fetching active timer:', error)
      setActiveTimer(null)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    if (!activeTimer) return
    
    try {
      await api.post('/time/stop')
      setActiveTimer(null)
      setElapsed(0)
      
      // Optionally refresh the parent component's data
      window.location.reload()
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return null
  }

  if (!activeTimer) {
    return (
      <Card className="fixed bottom-6 left-6 shadow-lg border-2 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">אין טיימר פעיל</p>
              <p className="text-xs text-gray-500">התחל עבודה על משימה</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="fixed bottom-6 left-6 shadow-xl border-2 border-red-300 bg-gradient-to-r from-red-500 to-red-600 text-white animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center justify-between min-w-[280px]">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <p className="font-bold text-sm">טיימר פעיל</p>
            </div>
            <p className="text-lg font-bold font-mono">{formatTime(elapsed)}</p>
            <p className="text-xs opacity-90 truncate">
              {activeTimer.task.title}
            </p>
            <p className="text-xs opacity-75 truncate">
              {activeTimer.project.name}
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleStop}
              className="bg-white text-red-600 hover:bg-gray-100 shadow-md"
            >
              <Square className="w-4 h-4 ml-1" />
              עצור
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}