import { useState, useEffect, useCallback } from 'react'
import { remindersAPI } from '../services/api'
import { StatusBadge, LoadingSpinner, PageHeader, EmptyState } from '../components/ui'
import { History, Search } from 'lucide-react'
import { formatDate } from '../utils/date'
import toast from 'react-hot-toast'

export default function MessageHistory() {
  const [reminders, setReminders] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [logsMap, setLogsMap] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await remindersAPI.list({ page, per_page: 20, search, status: 'SENT' })
      // Also load FAILED
      const res2 = await remindersAPI.list({ page, per_page: 20, search, status: 'FAILED' })
      const combined = [...(res.data.data.items || []), ...(res2.data.data.items || [])]
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      setReminders(combined)
      setPagination(res.data.data.pagination)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!logsMap[id]) {
      try {
        const res = await remindersAPI.get(id)
        setLogsMap(m => ({ ...m, [id]: res.data.data.logs || [] }))
      } catch { }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Message History" description="Sent and failed messages" />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input type="text" placeholder="Search messages..." className="input-field pl-9"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : reminders.length === 0 ? (
        <EmptyState icon={History} title="No message history" description="Sent and failed reminders will appear here." />
      ) : (
        <div className="space-y-3">
          {reminders.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(r.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                  {r.recipient_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-900 text-sm">{r.recipient_name}</span>
                    <span className="text-xs text-gray-400">{r.phone_number}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{r.message}</p>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap ml-2">
                  {formatDate(r.updated_at)}
                </div>
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Delivery Logs</p>
                  {logsMap[r.id] ? (
                    logsMap[r.id].length === 0 ? (
                      <p className="text-xs text-gray-400">No delivery logs available</p>
                    ) : (
                      logsMap[r.id].map(log => (
                        <div key={log.id} className="text-xs text-gray-600 space-y-1 bg-white p-3 rounded-lg border border-gray-200 mb-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={log.delivery_status} />
                            {log.sent_at && <span className="text-gray-400">{formatDate(log.sent_at)}</span>}
                          </div>
                          {log.whatsapp_message_id && (
                            <p className="font-mono text-gray-400">ID: {log.whatsapp_message_id}</p>
                          )}
                          {log.error_message && (
                            <p className="text-red-500">Error: {log.error_message}</p>
                          )}
                        </div>
                      ))
                    )
                  ) : (
                    <LoadingSpinner size="sm" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

