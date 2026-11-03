import { useState, useEffect, useCallback } from 'react'
import { contactsAPI } from '../services/api'
import { ConfirmModal, LoadingSpinner, PageHeader, EmptyState, Modal } from '../components/ui'
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'

function ContactForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial || { contact_name: '', phone_number: '' })
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input type="text" className="input-field" placeholder="Rahul Sharma"
          value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
      </div>
      <div>
        <label className="label">WhatsApp Number *</label>
        <input type="tel" className="input-field" placeholder="+919876543210"
          value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </div>
  )
}

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState({ type: null, contact: null })
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await contactsAPI.list({ page, per_page: 20, search })
      setContacts(res.data.data.items)
      setPagination(res.data.data.pagination)
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleCreate = async (form) => {
    if (!form.contact_name.trim() || !form.phone_number.trim()) {
      return toast.error('Name and phone are required')
    }
    setActionLoading(true)
    try {
      await contactsAPI.create(form)
      toast.success('Contact created')
      setModal({ type: null, contact: null })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async (form) => {
    setActionLoading(true)
    try {
      await contactsAPI.update(modal.contact.id, form)
      toast.success('Contact updated')
      setModal({ type: null, contact: null })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await contactsAPI.delete(modal.contact.id)
      toast.success('Contact deleted')
      setModal({ type: null, contact: null })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Contacts"
        description={`${pagination.total ?? 0} contacts`}
        action={
          <button onClick={() => setModal({ type: 'create', contact: null })} className="btn-primary">
            <Plus className="w-4 h-4" />Add Contact
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input type="text" placeholder="Search contacts..." className="input-field pl-9"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add contacts to quickly select recipients when creating reminders."
          action={
            <button onClick={() => setModal({ type: 'create', contact: null })} className="btn-primary">
              <Plus className="w-4 h-4" />Add First Contact
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map(c => (
            <div key={c.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold flex-shrink-0">
                  {c.contact_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{c.contact_name}</p>
                  <p className="text-sm text-gray-500">{c.phone_number}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ type: 'edit', contact: c })}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setModal({ type: 'delete', contact: c })}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => p - 1)} disabled={!pagination.has_prev} className="btn-secondary text-sm">Prev</button>
          <span className="flex items-center text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!pagination.has_next} className="btn-secondary text-sm">Next</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modal.type === 'create'} onClose={() => setModal({ type: null, contact: null })} title="Add Contact">
        <ContactForm onSave={handleCreate} onCancel={() => setModal({ type: null, contact: null })} loading={actionLoading} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal.type === 'edit'} onClose={() => setModal({ type: null, contact: null })} title="Edit Contact">
        <ContactForm
          initial={modal.contact}
          onSave={handleUpdate}
          onCancel={() => setModal({ type: null, contact: null })}
          loading={actionLoading}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={modal.type === 'delete'}
        onClose={() => setModal({ type: null, contact: null })}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Delete ${modal.contact?.contact_name}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={actionLoading}
      />
    </div>
  )
}

