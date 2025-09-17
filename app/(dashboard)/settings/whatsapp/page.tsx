'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  MessageCircle,
  Send,
  CheckCircle2,
  AlertCircle,
  Phone,
  Settings,
  TestTube,
  Bell
} from 'lucide-react'

export default function WhatsAppSettingsPage() {
  const [testPhone, setTestPhone] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [notifications, setNotifications] = useState({
    newLeads: true,
    paymentReminders: true,
    projectDeadlines: true,
    dailySummary: true
  })

  const handleTestMessage = async () => {
    if (!testPhone) {
      toast.error('נא להזין מספר טלפון')
      return
    }

    setIsTesting(true)
    try {
      const response = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('הודעת בדיקה נשלחה בהצלחה!')
      } else {
        toast.error(data.error || 'שליחת הודעת בדיקה נכשלה')
      }
    } catch {
      toast.error('שגיאה בשליחת הודעת בדיקה')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveSettings = () => {
    // In a real app, this would save to the database
    localStorage.setItem('whatsappSettings', JSON.stringify({
      isEnabled,
      notifications
    }))
    toast.success('ההגדרות נשמרו בהצלחה')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-green-600" />
          הגדרות WhatsApp
        </h1>
        <p className="text-muted-foreground mt-2">
          נהל את ההתראות והעדכונים דרך WhatsApp Business
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">הגדרות כלליות</TabsTrigger>
          <TabsTrigger value="notifications">התראות</TabsTrigger>
          <TabsTrigger value="test">בדיקה</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                הגדרות כלליות
              </CardTitle>
              <CardDescription>
                הגדרות בסיסיות לאינטגרציית WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="whatsapp-enabled">הפעל התראות WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    קבל התראות על אירועים חשובים במערכת
                  </p>
                </div>
                <Switch
                  id="whatsapp-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>מספר עסקי</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Phone className="h-4 w-4" />
                  <span className="font-mono">711579382048615</span>
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-auto" />
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  המערכת משתמשת ב-WhatsApp Business API לשליחת התראות.
                  ודא שהמספר שלך רשום במערכת לקבלת עדכונים.
                </AlertDescription>
              </Alert>

              <Button onClick={handleSaveSettings} className="w-full">
                שמור הגדרות
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                סוגי התראות
              </CardTitle>
              <CardDescription>
                בחר אילו התראות תרצה לקבל ב-WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="new-leads">לידים חדשים</Label>
                  <p className="text-sm text-muted-foreground">
                    קבל התראה מיידית על כל ליד חדש
                  </p>
                </div>
                <Switch
                  id="new-leads"
                  checked={notifications.newLeads}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, newLeads: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="payment-reminders">תזכורות תשלום</Label>
                  <p className="text-sm text-muted-foreground">
                    התראות על תשלומים קרובים ובאיחור
                  </p>
                </div>
                <Switch
                  id="payment-reminders"
                  checked={notifications.paymentReminders}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, paymentReminders: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="project-deadlines">דדליינים של פרויקטים</Label>
                  <p className="text-sm text-muted-foreground">
                    התראות על דדליינים מתקרבים
                  </p>
                </div>
                <Switch
                  id="project-deadlines"
                  checked={notifications.projectDeadlines}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, projectDeadlines: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="daily-summary">סיכום יומי</Label>
                  <p className="text-sm text-muted-foreground">
                    סיכום יומי בשעה 09:00
                  </p>
                </div>
                <Switch
                  id="daily-summary"
                  checked={notifications.dailySummary}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, dailySummary: checked }))
                  }
                />
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                שמור העדפות התראות
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                בדיקת חיבור
              </CardTitle>
              <CardDescription>
                שלח הודעת בדיקה לוודא שהחיבור פועל כראוי
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone">מספר טלפון לבדיקה</Label>
                <Input
                  id="test-phone"
                  type="tel"
                  placeholder="972501234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="text-left"
                  dir="ltr"
                />
                <p className="text-sm text-muted-foreground">
                  הזן מספר טלפון בפורמט בינלאומי (ללא +)
                </p>
              </div>

              <Button
                onClick={handleTestMessage}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                    שולח הודעת בדיקה...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    שלח הודעת בדיקה
                  </>
                )}
              </Button>

              <Alert>
                <MessageCircle className="h-4 w-4" />
                <AlertDescription>
                  הודעת הבדיקה תכלול מידע אודות המערכת ותאשר שהחיבור פועל.
                  ודא שהמספר שהזנת רשום ב-WhatsApp.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold">תוכן הודעת הבדיקה:</h4>
                <p className="text-sm whitespace-pre-wrap font-mono" dir="rtl">
{`🧪 בדיקת מערכת CRM

זוהי הודעת בדיקה מהמערכת.
אם קיבלת הודעה זו, האינטגרציה עם WhatsApp פועלת כראוי!

✅ המערכת מוכנה לשליחת התראות
📱 מספר: ${testPhone || 'XXXXXXXXXXXX'}
🕐 זמן: ${new Date().toLocaleString('he-IL')}

בהצלחה!`}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}