import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle, XCircle, Clock, TrendingUp, Plus, AlertTriangle } from 'lucide-react'
import { dashboardAPI } from '../services/api'
import { StatCard, StatusBadge, LoadingSpinner, PageHeader } from '../components/ui'
import { formatDate } from '../utils/date'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a, u] = await Promise.all([
          dashboardAPI.stats(),
          dashboardAPI.recentActivity(),
          dashboardAPI.upcoming(),
        ])
        setStats(s.data.data)
        setActivity(a.data.data)
        setUpcoming(u.data.data)
      } catch {
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Overview of your WhatsApp reminders"
        action={
          <button onClick={() => navigate('/reminders/create')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Reminder
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="xl:col-span-1">
          <StatCard icon={TrendingUp} label="Total" value={stats?.total ?? 0} color="blue" />
        </div>
        <div className="xl:col-span-1">
          <StatCard icon={Clock} label="Pending" value={stats?.pending ?? 0} color="yellow" />
        </div>
        <div className="xl:col-span-1">
          <StatCard icon={CheckCircle} label="Sent" value={stats?.sent ?? 0} color="green" />
        </div>
        <div className="xl:col-span-1">
          <StatCard icon={XCircle} label="Failed" value={stats?.failed ?? 0} color="red" />
        </div>
        <div className="xl:col-span-1">
          <StatCard icon={AlertTriangle} label="Cancelled" value={stats?.cancelled ?? 0} color="gray" />
        </div>
        <div className="xl:col-span-1">
          <StatCard icon={Bell} label="Next 24h" value={stats?.upcoming_24h ?? 0} color="purple" subLabel="upcoming" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-3 card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-green-700 font-bold text-xs">
                    {item.recipient_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{item.recipient_name}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{item.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.scheduled_at, item.timezone)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activity.length > 0 && (
            <button onClick={() => navigate('/reminders')} className="mt-4 text-sm text-green-600 hover:underline">
              View all reminders →
            </button>
          )}
        </div>

        {/* Upcoming Reminders */}
        <div className="lg:col-span-2 card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No upcoming reminders</p>
              <button onClick={() => navigate('/reminders/create')} className="mt-3 text-sm text-green-600 hover:underline">
                Schedule one →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(r => (
                <div key={r.id} className="p-3 border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{r.recipient_name}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{r.message}</p>
                  <p className="text-xs text-green-600 font-medium mt-1">{formatDate(r.scheduled_at, r.timezone)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

