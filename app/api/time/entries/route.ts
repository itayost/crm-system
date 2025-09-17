// app/api/time/entries/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { mockDb } from '@/lib/api/mock-db'

const createManualEntrySchema = z.object({
  projectId: z.string(),
  taskId: z.string().optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string().optional(),
})

// GET /api/time/entries
export const GET = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  
  let entries = mockDb.timeEntries.filter(entry => entry.userId === userId)
  
  if (projectId) {
    entries = entries.filter(entry => entry.projectId === projectId)
  }
  
  if (startDate) {
    const start = new Date(startDate)
    entries = entries.filter(entry => new Date(entry.startTime) >= start)
  }
  
  if (endDate) {
    const end = new Date(endDate)
    entries = entries.filter(entry => new Date(entry.startTime) <= end)
  }
  
  // Include project and task data
  const entriesWithDetails = entries.map(entry => {
    const project = mockDb.projects.find(p => p.id === entry.projectId)
    const task = entry.taskId ? mockDb.tasks.find(t => t.id === entry.taskId) : null
    return {
      ...entry,
      project,
      task,
    }
  })
  
  // Sort by start time (newest first)
  entriesWithDetails.sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  
  return createResponse(entriesWithDetails)
})

// POST /api/time/entries - Create manual entry
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const validatedData = createManualEntrySchema.parse(body)
  
  // Calculate duration
  const startTime = new Date(`${validatedData.date}T${validatedData.startTime}`)
  const endTime = new Date(`${validatedData.date}T${validatedData.endTime}`)
  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)
  
  if (duration <= 0) {
    return errorResponse('End time must be after start time', 400)
  }
  
  const newEntry = {
    id: Date.now().toString(),
    projectId: validatedData.projectId,
    taskId: validatedData.taskId,
    description: validatedData.description,
    startTime,
    endTime,
    duration,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  mockDb.timeEntries.push(newEntry)
  
  // Update project actual hours
  const projectIndex = mockDb.projects.findIndex(p => p.id === validatedData.projectId)
  if (projectIndex !== -1) {
    mockDb.projects[projectIndex].actualHours = 
      (mockDb.projects[projectIndex].actualHours || 0) + (duration / 60)
  }
  
  return createResponse(newEntry, 201)
})