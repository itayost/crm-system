// app/(dashboard)/settings/page.tsx
'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Settings, Shield, ChevronLeft, MessageSquare } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN'

  const settingsOptions = [
    {
      title: 'ניהול משתמשים',
      description: 'נהל משתמשים והרשאות במערכת',
      icon: Users,
      href: '/settings/users',
      adminOnly: true,
    },
    {
      title: 'הגדרות WhatsApp',
      description: 'הגדר חיבור ל-WhatsApp Business',
      icon: MessageSquare,
      href: '/settings/whatsapp',
      adminOnly: false,
    },
    {
      title: 'הגדרות כלליות',
      description: 'הגדרות כלליות של המערכת',
      icon: Settings,
      href: '#',
      adminOnly: false,
      disabled: true,
    },
  ]

  const filteredOptions = settingsOptions.filter(
    option => !option.adminOnly || isAdmin
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">הגדרות</h1>
        <p className="text-gray-600 mt-1">נהל את הגדרות המערכת</p>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOptions.map((option, index) => (
          <Card
            key={index}
            className={`hover:shadow-lg transition-shadow ${option.disabled ? 'opacity-50' : ''}`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <option.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                  {option.adminOnly && (
                    <Badge variant="secondary" className="mt-1">
                      <Shield className="w-3 h-3 ml-1" />
                      מנהלים בלבד
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {option.description}
              </CardDescription>
              {option.disabled ? (
                <Button variant="outline" disabled className="w-full">
                  בקרוב
                </Button>
              ) : (
                <Link href={option.href}>
                  <Button variant="outline" className="w-full">
                    <span>כניסה</span>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי משתמש</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">שם:</span>
              <span className="font-medium">{session?.user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">אימייל:</span>
              <span className="font-medium" dir="ltr">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">תפקיד:</span>
              <span className="font-medium">
                {session?.user?.role === 'OWNER' && 'בעלים'}
                {session?.user?.role === 'ADMIN' && 'מנהל'}
                {session?.user?.role === 'USER' && 'משתמש'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}