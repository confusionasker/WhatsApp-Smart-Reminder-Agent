import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { remindersAPI } from '../services/api'
import { StatusBadge, ConfirmModal, LoadingSpinner, PageHeader, EmptyState } from '../components/ui'
import { Plus, Search, RefreshCw, XCircle, Trash2, RotateCcw, Filter, Bell } from 'lucide-react'
import { formatDate } from '../utils/date'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = ['', 'PENDING', 'SCHEDULED', 'SENT', 'FAILED', 'CANCELLED']

export default function Reminders() {
  const navigate = useNavigate()
  const [reminders, setReminders] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState(null)
  const [modal, setModal] = useState({ type: null, id: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await remindersAPI.list({ page, per_page: 20, search, status: statusFilter })
      setReminders(res.data.data.items)
      setPagination(res.data.data.pagination)
    } catch {
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleCancel = async () => {
    setActionLoading(modal.id)
    try {
      await remindersAPI.cancel(modal.id)
      toast.success('Reminder cancelled')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel')
    } finally {
      setActionLoading(null)
      setModal({ type: null, id: null })
    }
  }

  const handleDelete = async () => {
    setActionLoading(modal.id)
    try {
      await remindersAPI.delete(modal.id)
      toast.success('Reminder deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setActionLoading(null)
      setModal({ type: null, id: null })
    }
  }

  const handleRetry = async (id) => {
    setActionLoading(id)
    try {
      await remindersAPI.retry(id)
      toast.success('Reminder queued for retry')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to retry')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Reminders"
        description={`${pagination.total ?? 0} total reminders`}
        action={
          <button onClick={() => navigate('/reminders/create')} className="btn-primary">
            <Plus className="w-4 h-4" />New Reminder
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search reminders..." className="input-field pl-9"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="input-field w-auto" value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders found"
          description="Create your first reminder to get started."
          action={<button onClick={() => navigate('/reminders/create')} className="btn-primary">
            <Plus className="w-4 h-4" />New Reminder
          </button>}
        />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Message</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Scheduled</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reminders.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.recipient_name}</div>
                        <div className="text-xs text-gray-400">{r.phone_number}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-gray-600">{r.message}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {formatDate(r.scheduled_at, r.timezone)}
                        <div className="text-xs text-gray-400">{r.timezone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {r.retry_count > 0 && (
                          <span className="ml-1 text-xs text-gray-400">({r.retry_count} retries)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {['PENDING', 'SCHEDULED'].includes(r.status) && (
                            <button
                              onClick={() => setModal({ type: 'cancel', id: r.id })}
                              disabled={actionLoading === r.id}
                              className="p-1.5 text-gray-400 hover:text-yellow-600 rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {r.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(r.id)}
                              disabled={actionLoading === r.id}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                              title="Retry"
                            >
                              {actionLoading === r.id ? <LoadingSpinner size="sm" /> : <RotateCcw className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ type: 'delete', id: r.id })}
                            disabled={actionLoading === r.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={!pagination.has_prev}
                  className="btn-secondary text-sm py-1">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={!pagination.has_next}
                  className="btn-secondary text-sm py-1">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={modal.type === 'cancel'}
        onClose={() => setModal({ type: null, id: null })}
        onConfirm={handleCancel}
        title="Cancel Reminder"
        message="Are you sure you want to cancel this reminder? It will not be sent."
        confirmLabel="Cancel Reminder"
        danger
        loading={actionLoading === modal.id}
      />
      <ConfirmModal
        open={modal.type === 'delete'}
        onClose={() => setModal({ type: null, id: null })}
        onConfirm={handleDelete}
        title="Delete Reminder"
        message="This will permanently delete the reminder and all its logs. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={actionLoading === modal.id}
      />
    </div>
  )
}

