import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { remindersAPI, contactsAPI, aiAPI } from '../services/api'
import { PageHeader, LoadingSpinner } from '../components/ui'
import { Save, Sparkles, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles',
  'America/Chicago', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney',
]

function FormField({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function CreateReminder() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    recipient_name: '', phone_number: '', message: '',
    scheduled_date: '', scheduled_time: '', timezone: 'Asia/Kolkata',
    contact_id: '',
  })
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiParsed, setAiParsed] = useState(null)
  const [errors, setErrors] = useState({})

  // Min date = today
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    contactsAPI.list({ per_page: 100 }).then(r => setContacts(r.data.data.items || [])).catch(() => {})
  }, [])

  const handleContactSelect = (e) => {
    const cid = e.target.value
    setForm(f => ({ ...f, contact_id: cid }))
    if (cid) {
      const c = contacts.find(x => String(x.id) === cid)
      if (c) setForm(f => ({ ...f, recipient_name: c.contact_name, phone_number: c.phone_number }))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.recipient_name.trim()) errs.recipient_name = 'Required'
    if (!form.phone_number.trim()) errs.phone_number = 'Required'
    if (!form.message.trim()) errs.message = 'Required'
    if (!form.scheduled_date) errs.scheduled_date = 'Required'
    if (!form.scheduled_time) errs.scheduled_time = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await remindersAPI.create({
        recipient_name: form.recipient_name,
        phone_number: form.phone_number,
        message: form.message,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        timezone: form.timezone,
        contact_id: form.contact_id ? Number(form.contact_id) : undefined,
      })
      toast.success('Reminder scheduled!')
      navigate('/reminders')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create reminder'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleAiParse = async () => {
    if (!aiText.trim()) return toast.error('Enter a description first')
    setAiLoading(true)
    setAiParsed(null)
    try {
      const res = await aiAPI.parseReminder(aiText)
      const parsed = res.data.data.parsed
      setAiParsed(parsed)
      // Pre-fill form with parsed values
      setForm(f => ({
        ...f,
        recipient_name: parsed.recipient_name || f.recipient_name,
        phone_number: parsed.phone_number || f.phone_number,
        message: parsed.message || f.message,
        scheduled_date: parsed.scheduled_date || f.scheduled_date,
        scheduled_time: parsed.scheduled_time || f.scheduled_time,
        timezone: parsed.timezone || f.timezone,
      }))
      toast.success('AI parsed your reminder! Please review and confirm.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI service unavailable')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="New Reminder" description="Schedule a WhatsApp message" />

      {/* AI Input */}
      <div className="card mb-6 border-green-200 bg-green-50">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-semibold text-green-800">AI Smart Parse (Optional)</h3>
        </div>
        <p className="text-xs text-green-700 mb-3">
          Type naturally: "Remind Rahul tomorrow at 10 AM about the project meeting"
        </p>
        <div className="flex gap-2">
          <input
            type="text" className="input-field text-sm"
            placeholder="Describe your reminder in plain English..."
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAiParse()}
          />
          <button onClick={handleAiParse} disabled={aiLoading} className="btn-primary text-sm flex-shrink-0">
            {aiLoading ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-4 h-4" />Parse</>}
          </button>
        </div>
        {aiParsed && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-green-200 text-xs text-gray-600">
            <p className="font-medium text-green-800 mb-1">AI extracted (confirm below):</p>
            <p>Name: <strong>{aiParsed.recipient_name || 'N/A'}</strong></p>
            <p>Phone: <strong>{aiParsed.phone_number || 'N/A'}</strong></p>
            <p>Date: <strong>{aiParsed.scheduled_date || 'N/A'}</strong> {aiParsed.scheduled_time && `at ${aiParsed.scheduled_time}`}</p>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        {contacts.length > 0 && (
          <FormField label="Select from Contacts (optional)">
            <select className="input-field" value={form.contact_id} onChange={handleContactSelect}>
              <option value="">-- Choose a contact --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.contact_name} ({c.phone_number})</option>
              ))}
            </select>
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Recipient Name *" error={errors.recipient_name}>
            <input type="text" className="input-field" placeholder="Rahul"
              value={form.recipient_name}
              onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} />
          </FormField>
          <FormField label="WhatsApp Number *" error={errors.phone_number}>
            <input type="tel" className="input-field" placeholder="+919876543210"
              value={form.phone_number}
              onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
          </FormField>
        </div>

        <FormField label="Message *" error={errors.message}>
          <textarea rows={4} className="input-field resize-none" placeholder="Your meeting starts in 30 minutes."
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">{form.message.length}/4096</p>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Date *" error={errors.scheduled_date}>
            <input type="date" className="input-field" min={today}
              value={form.scheduled_date}
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
          </FormField>
          <FormField label="Time *" error={errors.scheduled_time}>
            <input type="time" className="input-field"
              value={form.scheduled_time}
              onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
          </FormField>
          <FormField label="Timezone">
            <select className="input-field" value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </FormField>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/reminders')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            {loading ? 'Scheduling...' : 'Schedule Reminder'}
          </button>
        </div>
      </form>
    </div>
  )
}

