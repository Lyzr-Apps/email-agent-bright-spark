'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { callAIAgent } from '@/lib/aiAgent'
import { getSchedule, pauseSchedule, resumeSchedule, triggerScheduleNow, getScheduleLogs, cronToHuman } from '@/lib/scheduler'
import { FiSettings, FiMail, FiCheckCircle, FiAlertCircle, FiClock, FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi'
import { Loader2 } from 'lucide-react'

const AGENT_ID = '698dad822332705a73b4cbea'
const SCHEDULE_ID = '698daf7cebe6fd87d1dcc173'

// Theme colors (Heritage Premium)
const THEME_VARS = {
  '--background': '35 29% 95%',
  '--foreground': '30 22% 14%',
  '--card': '35 29% 92%',
  '--card-foreground': '30 22% 14%',
  '--primary': '27 61% 26%',
  '--primary-foreground': '35 29% 98%',
  '--secondary': '35 20% 88%',
  '--secondary-foreground': '30 22% 18%',
  '--accent': '43 75% 38%',
  '--destructive': '0 84% 60%',
  '--border': '27 61% 26%',
  '--input': '35 15% 75%',
  '--muted': '35 15% 85%',
  '--muted-foreground': '30 20% 45%',
  '--radius': '0.5rem',
} as React.CSSProperties

interface TaskItem {
  description: string
  priority: string
  sourceEmail: {
    subject: string
    sender: string
  }
  deadline?: string
}

interface AgentResponse {
  tasks: TaskItem[]
  emailsProcessed: number
  generatedAt: string
  status: string
}

interface HistoryEntry {
  date: string
  tasks: TaskItem[]
  emailsProcessed: number
  status: string
}

interface ScheduleInfo {
  id: string
  status: string
  next_run: string
  cron_expression: string
  timezone: string
}

interface ScheduleRun {
  id: string
  status: string
  started_at: string
  completed_at?: string
}

function TaskCard({ task, expanded, onToggle }: { task: TaskItem; expanded: boolean; onToggle: () => void }) {
  const priorityColors = {
    High: 'bg-red-100 text-red-800 border-red-300',
    Medium: 'bg-amber-100 text-amber-800 border-amber-300',
    Low: 'bg-green-100 text-green-800 border-green-300',
  }

  const priorityColor = priorityColors[task.priority as keyof typeof priorityColors] || 'bg-muted text-muted-foreground'

  return (
    <Card className="bg-card border-border hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-base font-serif font-semibold text-foreground leading-relaxed">
              {task.description}
            </CardTitle>
          </div>
          <Badge className={`${priorityColor} font-sans text-xs px-2 py-1 border`}>
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground font-sans space-y-1">
          <div className="flex items-start gap-2">
            <FiMail className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-foreground">{task.sourceEmail?.subject ?? 'No subject'}</div>
              <div className="text-xs">From: {task.sourceEmail?.sender ?? 'Unknown'}</div>
            </div>
          </div>
        </div>

        {task.deadline && (
          <div className="flex items-center gap-2 text-sm text-accent font-medium">
            <FiClock />
            <span>Deadline: {task.deadline}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground w-full"
        >
          {expanded ? 'Show less' : 'Show full details'}
        </Button>

        {expanded && (
          <div className="pt-2 border-t border-border text-sm text-foreground font-sans leading-relaxed">
            <div className="space-y-2">
              <div>
                <span className="font-semibold">Full Description:</span> {task.description}
              </div>
              <div>
                <span className="font-semibold">Priority Level:</span> {task.priority}
              </div>
              <div>
                <span className="font-semibold">Source:</span> {task.sourceEmail?.subject ?? 'N/A'} ({task.sourceEmail?.sender ?? 'N/A'})
              </div>
              {task.deadline && (
                <div>
                  <span className="font-semibold">Due By:</span> {task.deadline}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [time, setTime] = useState('16:30')

  const handleSave = () => {
    localStorage.setItem('recipientEmail', email)
    localStorage.setItem('scheduledTime', time)
    onOpenChange(false)
  }

  useEffect(() => {
    if (open) {
      setEmail(localStorage.getItem('recipientEmail') || '')
      setTime(localStorage.getItem('scheduledTime') || '16:30')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure your daily email task digest preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-sans font-medium">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background border-input text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time" className="font-sans font-medium">Scheduled Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-background border-input text-foreground"
            />
            <p className="text-xs text-muted-foreground">Timezone: America/New_York (EST/EDT)</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Home() {
  const [sampleDataMode, setSampleDataMode] = useState(false)
  const [currentTasks, setCurrentTasks] = useState<AgentResponse | null>(null)
  const [taskHistory, setTaskHistory] = useState<HistoryEntry[]>([])
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null)
  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRun[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected')

  // Sample data for demonstration
  const sampleTasks: AgentResponse = {
    tasks: [
      {
        description: 'Review and approve Q1 budget proposal from Finance team',
        priority: 'High',
        sourceEmail: {
          subject: 'Q1 Budget Proposal - Needs Approval',
          sender: 'finance@company.com'
        },
        deadline: 'Today, 5:00 PM'
      },
      {
        description: 'Schedule project kickoff meeting with development team',
        priority: 'Medium',
        sourceEmail: {
          subject: 'New Project: Dashboard Redesign',
          sender: 'pm@company.com'
        },
        deadline: 'This Week'
      },
      {
        description: 'Respond to client inquiry about feature request',
        priority: 'High',
        sourceEmail: {
          subject: 'Feature Request: Export Functionality',
          sender: 'client@example.com'
        },
        deadline: 'Tomorrow, 2:00 PM'
      },
      {
        description: 'Review team performance reports for monthly meeting',
        priority: 'Low',
        sourceEmail: {
          subject: 'Monthly Performance Summary',
          sender: 'hr@company.com'
        },
        deadline: 'End of Week'
      },
      {
        description: 'Update documentation for API integration process',
        priority: 'Medium',
        sourceEmail: {
          subject: 'API Documentation Updates Needed',
          sender: 'dev@company.com'
        }
      }
    ],
    emailsProcessed: 47,
    generatedAt: new Date().toISOString(),
    status: 'success'
  }

  const sampleHistory: HistoryEntry[] = [
    {
      date: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        {
          description: 'Complete quarterly performance reviews',
          priority: 'High',
          sourceEmail: { subject: 'Q4 Reviews Due', sender: 'hr@company.com' }
        },
        {
          description: 'Update project timeline with stakeholders',
          priority: 'Medium',
          sourceEmail: { subject: 'Project Timeline Discussion', sender: 'pm@company.com' }
        }
      ],
      emailsProcessed: 32,
      status: 'success'
    },
    {
      date: new Date(Date.now() - 172800000).toISOString(),
      tasks: [
        {
          description: 'Review contract renewal proposals',
          priority: 'High',
          sourceEmail: { subject: 'Contract Renewals - Action Required', sender: 'legal@company.com' }
        }
      ],
      emailsProcessed: 28,
      status: 'success'
    }
  ]

  // Load schedule info on mount
  useEffect(() => {
    loadScheduleInfo()
    loadScheduleRuns()
    loadHistoryFromStorage()
  }, [])

  // Apply sample data when toggle changes
  useEffect(() => {
    if (sampleDataMode) {
      setCurrentTasks(sampleTasks)
      setTaskHistory(sampleHistory)
    } else {
      setCurrentTasks(null)
      setTaskHistory([])
    }
  }, [sampleDataMode])

  const loadHistoryFromStorage = () => {
    const stored = localStorage.getItem('taskHistory')
    if (stored) {
      try {
        setTaskHistory(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load history:', e)
      }
    }
  }

  const saveHistoryToStorage = (history: HistoryEntry[]) => {
    localStorage.setItem('taskHistory', JSON.stringify(history))
  }

  const loadScheduleInfo = async () => {
    try {
      const result = await getSchedule(SCHEDULE_ID)
      if (result?.success && result?.schedule) {
        // Map the schedule data to our interface
        setScheduleInfo({
          id: result.schedule.id,
          status: result.schedule.is_active ? 'active' : 'paused',
          next_run: result.schedule.next_run_time || 'Not scheduled',
          cron_expression: result.schedule.cron_expression,
          timezone: result.schedule.timezone
        })
      }
    } catch (error) {
      console.error('Failed to load schedule info:', error)
    }
  }

  const loadScheduleRuns = async () => {
    try {
      const result = await getScheduleLogs(SCHEDULE_ID, { limit: 10 })
      if (result?.success && Array.isArray(result?.executions)) {
        // Map execution logs to schedule runs format
        const runs = result.executions.map(exec => ({
          id: exec.id,
          status: exec.success ? 'success' : 'failed',
          started_at: exec.executed_at,
          completed_at: exec.executed_at
        }))
        setScheduleRuns(runs)
      }
    } catch (error) {
      console.error('Failed to load schedule runs:', error)
    }
  }

  const handleRunNow = async () => {
    setLoading(true)
    try {
      const result = await callAIAgent("Analyze yesterday's emails and send daily task list", AGENT_ID)

      if (result?.success && result?.response?.result) {
        const agentData = result.response.result

        // Guard all data access with optional chaining
        const newTaskData: AgentResponse = {
          tasks: Array.isArray(agentData?.tasks) ? agentData.tasks : [],
          emailsProcessed: agentData?.emailsProcessed ?? 0,
          generatedAt: agentData?.generatedAt ?? new Date().toISOString(),
          status: agentData?.status ?? 'unknown'
        }

        setCurrentTasks(newTaskData)

        // Add to history
        const newHistory: HistoryEntry = {
          date: newTaskData.generatedAt,
          tasks: newTaskData.tasks,
          emailsProcessed: newTaskData.emailsProcessed,
          status: newTaskData.status
        }

        const updatedHistory = [newHistory, ...taskHistory].slice(0, 30)
        setTaskHistory(updatedHistory)
        saveHistoryToStorage(updatedHistory)

        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Failed to run agent:', error)
      setConnectionStatus('disconnected')
    } finally {
      setLoading(false)
    }
  }

  const handleRunScheduleNow = async () => {
    setScheduleLoading(true)
    try {
      const result = await triggerScheduleNow(SCHEDULE_ID)
      if (result?.success) {
        setTimeout(() => {
          loadScheduleRuns()
          handleRunNow()
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to run schedule:', error)
    } finally {
      setScheduleLoading(false)
    }
  }

  const handleToggleSchedule = async () => {
    if (!scheduleInfo) return

    setScheduleLoading(true)
    try {
      if (scheduleInfo.status === 'active') {
        await pauseSchedule(SCHEDULE_ID)
      } else {
        await resumeSchedule(SCHEDULE_ID)
      }
      await loadScheduleInfo()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
    } finally {
      setScheduleLoading(false)
    }
  }

  const toggleTaskExpanded = (index: number) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedTasks(newExpanded)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const formatNextRun = (nextRunString?: string) => {
    if (!nextRunString || nextRunString === 'Not scheduled') return 'Not scheduled'
    try {
      const nextRun = new Date(nextRunString)

      // Check if date is valid
      if (isNaN(nextRun.getTime())) {
        return 'Not scheduled'
      }

      const now = new Date()
      const diff = nextRun.getTime() - now.getTime()

      if (diff < 0) return 'Pending...'

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      // Ensure we don't display NaN
      if (isNaN(hours) || isNaN(minutes)) {
        return 'Not scheduled'
      }

      if (hours > 24) {
        return nextRun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      }

      return `in ${hours}h ${minutes}m`
    } catch {
      return 'Not scheduled'
    }
  }

  const cronToHuman = (cron: string) => {
    // 30 16 * * * = Daily at 4:30 PM
    if (cron === '30 16 * * *') return 'Daily at 4:30 PM'
    return cron
  }

  const displayTasks = currentTasks?.tasks ?? []
  const displayEmailsProcessed = typeof currentTasks?.emailsProcessed === 'number' && !isNaN(currentTasks.emailsProcessed)
    ? currentTasks.emailsProcessed
    : 0
  const displayStatus = currentTasks?.status ?? 'ready'

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground tracking-wide leading-relaxed">
              Daily Email Task Agent
            </h1>
            <p className="text-muted-foreground font-sans mt-1">
              Automated email analysis and task extraction
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-sans">Sample Data</span>
              <Switch
                checked={sampleDataMode}
                onCheckedChange={setSampleDataMode}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="border-border hover:bg-secondary"
            >
              <FiSettings className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <>
                  <FiCheckCircle className="text-green-600 h-5 w-5" />
                  <span className="text-sm text-green-600 font-sans">Connected</span>
                </>
              ) : (
                <>
                  <FiAlertCircle className="text-destructive h-5 w-5" />
                  <span className="text-sm text-destructive font-sans">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground font-sans">Next Scheduled Run</div>
                <div className="text-2xl font-serif font-semibold text-foreground">
                  {scheduleInfo?.next_run ? formatNextRun(scheduleInfo.next_run) : 'Not scheduled'}
                </div>
                {scheduleInfo?.cron_expression && (
                  <div className="text-xs text-muted-foreground">{cronToHuman(scheduleInfo.cron_expression)}</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground font-sans">Last Run Status</div>
                <div className="flex items-center gap-2">
                  {displayStatus === 'success' ? (
                    <>
                      <FiCheckCircle className="text-green-600 h-5 w-5" />
                      <span className="text-lg font-sans font-medium text-foreground">Success</span>
                    </>
                  ) : (
                    <>
                      <FiClock className="text-muted-foreground h-5 w-5" />
                      <span className="text-lg font-sans font-medium text-muted-foreground">Ready</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground font-sans">Emails Processed</div>
                <div className="text-2xl font-serif font-semibold text-foreground">
                  {displayEmailsProcessed}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleRunNow}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-sans"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <FiRefreshCw className="mr-2 h-4 w-4" />
                Run Now
              </>
            )}
          </Button>

          {scheduleInfo && (
            <Button
              onClick={handleToggleSchedule}
              disabled={scheduleLoading}
              variant="outline"
              className="border-border hover:bg-secondary font-sans"
            >
              {scheduleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : scheduleInfo.status === 'active' ? (
                <FiPause className="mr-2 h-4 w-4" />
              ) : (
                <FiPlay className="mr-2 h-4 w-4" />
              )}
              {scheduleInfo.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
            </Button>
          )}

          <Button
            onClick={handleRunScheduleNow}
            disabled={scheduleLoading || loading}
            variant="outline"
            className="border-border hover:bg-secondary font-sans"
          >
            {scheduleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FiPlay className="mr-2 h-4 w-4" />
            )}
            Trigger Scheduled Run
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Tasks Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-serif text-foreground flex items-center justify-between">
                  <span>Today's Tasks</span>
                  {currentTasks && (
                    <Badge variant="outline" className="font-sans text-sm">
                      {displayTasks.length} {displayTasks.length === 1 ? 'task' : 'tasks'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-muted-foreground font-sans">
                  {currentTasks ? `Generated ${formatDate(currentTasks.generatedAt)}` : 'No tasks generated yet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {displayTasks.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {displayTasks.map((task, index) => (
                        <TaskCard
                          key={index}
                          task={task}
                          expanded={expandedTasks.has(index)}
                          onToggle={() => toggleTaskExpanded(index)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FiMail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-sans">No tasks available</p>
                    <p className="text-sm mt-2">
                      {sampleDataMode ? 'Toggle off sample data to run live agent' : 'Click "Run Now" to analyze emails or toggle on Sample Data'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task History */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-serif text-foreground">Task History</CardTitle>
                <CardDescription className="text-muted-foreground font-sans">
                  Previous daily summaries (last 30 days)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {taskHistory.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {taskHistory.map((entry, entryIndex) => (
                        <div key={entryIndex} className="border border-border rounded-lg p-4 bg-background">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-sans font-medium text-foreground">
                              {formatDate(entry.date)}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{entry.emailsProcessed} emails</span>
                              <Badge variant={entry.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                                {entry.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {Array.isArray(entry.tasks) && entry.tasks.slice(0, 3).map((task, taskIndex) => (
                              <div key={taskIndex} className="text-sm text-foreground font-sans flex items-start gap-2">
                                <span className="text-muted-foreground">•</span>
                                <span className="flex-1">{task.description}</span>
                                <Badge variant="outline" className="text-xs">
                                  {task.priority}
                                </Badge>
                              </div>
                            ))}
                            {Array.isArray(entry.tasks) && entry.tasks.length > 3 && (
                              <div className="text-xs text-muted-foreground pl-4">
                                +{entry.tasks.length - 3} more tasks
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-sans">No history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Schedule Management Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-serif text-foreground">Schedule Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleInfo ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground font-sans">Status</span>
                        <Badge
                          variant={scheduleInfo.status === 'active' ? 'default' : 'outline'}
                          className="font-sans"
                        >
                          {scheduleInfo.status}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground font-sans">Schedule</div>
                        <div className="text-sm font-sans font-medium text-foreground">
                          {scheduleInfo.cron_expression ? cronToHuman(scheduleInfo.cron_expression) : 'Not set'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground font-sans">Timezone</div>
                        <div className="text-sm font-sans font-medium text-foreground">
                          {scheduleInfo.timezone ?? 'Not set'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground font-sans">Next Run</div>
                        <div className="text-sm font-sans font-medium text-foreground">
                          {scheduleInfo.next_run ? formatDate(scheduleInfo.next_run) : 'Not scheduled'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2 font-sans">Loading schedule...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Runs */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-serif text-foreground">Recent Runs</CardTitle>
                <CardDescription className="text-muted-foreground font-sans">
                  Last 10 scheduled executions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleRuns.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {scheduleRuns.map((run, index) => (
                        <div key={run.id || index} className="flex items-start justify-between gap-2 pb-3 border-b border-border last:border-0">
                          <div className="flex-1">
                            <div className="text-sm font-sans font-medium text-foreground">
                              {run.started_at ? formatDate(run.started_at) : 'Unknown time'}
                            </div>
                            {run.completed_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Completed: {formatDate(run.completed_at)}
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'outline'}
                            className="text-xs font-sans"
                          >
                            {run.status ?? 'unknown'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm font-sans">No run history available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-serif text-foreground text-sm">Agent Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans">Agent</span>
                    <span className="font-mono text-foreground">Email Task Agent</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans">Type</span>
                    <span className="font-mono text-foreground">Text + JSON</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans">Status</span>
                    <Badge variant="outline" className="text-xs">
                      {loading ? 'Processing' : 'Ready'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
