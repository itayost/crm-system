'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ClientForm } from '@/components/forms/client-form'

interface Client {
  id: string
  name: string
  isVip: boolean
  isInternal: boolean
  _count: { contacts: number; projects: number }
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const response = await api.get(`/clients?${params.toString()}`)
      setClients(response.data)
    } catch {
      toast.error('שגיאה בטעינת לקוחות')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchClients()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchClients, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
          <p className="text-sm text-gray-500 mt-1">
            עסקים, אנשי הקשר שלהם והפרויקטים
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 ml-2" />
          לקוח חדש
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="search"
          placeholder="חיפוש לפי שם עסק או ח.פ..."
          className="pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">אין לקוחות</p>
          <p className="text-sm mt-1">
            {search ? 'לא נמצאו תוצאות לחיפוש' : 'צור לקוח חדש כדי להתחיל'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם עסק</TableHead>
                <TableHead className="text-right">אנשי קשר</TableHead>
                <TableHead className="text-right">פרויקטים</TableHead>
                <TableHead className="text-right">VIP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client._count.contacts}</TableCell>
                  <TableCell>{client._count.projects}</TableCell>
                  <TableCell>
                    {client.isVip && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchClients}
      />
    </div>
  )
}
