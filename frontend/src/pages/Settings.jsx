import { useState, useEffect } from 'react'
import { whatsappAPI, aiAPI, authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { PageHeader, LoadingSpinner } from '../components/ui'
import { CheckCircle, XCircle, Send, User, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'

function StatusIndicator({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
      <span className={`text-sm ${ok ? 'text-green-700' : 'text-red-600'}`}>{label}</span>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [waStatus, setWaStatus] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from WhatsApp Smart Reminder Agent!')
  const [testing, setTesting] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: user?.name || '' })
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    whatsappAPI.status().then(r => setWaStatus(r.data.data)).catch(() => {})
    aiAPI.status().then(r => setAiStatus(r.data.data)).catch(() => {})
  }, [])

  const handleTestMessage = async () => {
    if (!testPhone.trim()) return toast.error('Enter phone number')
    setTesting(true)
    try {
      await whatsappAPI.test({ phone_number: testPhone, message: testMsg })
      toast.success('Test message sent!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test message')
    } finally {
      setTesting(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!profileForm.name.trim()) return toast.error('Name is required')
    setProfileLoading(true)
    try {
      await authAPI.updateProfile({ name: profileForm.name })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your account and integrations" />

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input type="text" className="input-field" value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input-field bg-gray-50" value={user?.email} disabled />
          </div>
          <button onClick={handleUpdateProfile} disabled={profileLoading} className="btn-primary">
            {profileLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* WhatsApp Status */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <h2 className="text-base font-semibold text-gray-900">WhatsApp API Status</h2>
        </div>
        {waStatus === null ? <LoadingSpinner size="sm" /> : (
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-sm font-semibold text-gray-800">📱 WhatsApp Web (QR Code)</p>
                <p className="text-xs text-gray-500">
                  {waStatus.qr_gateway?.connected
                    ? `Connected as: +${waStatus.qr_gateway?.phone || ''} (${waStatus.qr_gateway?.name || 'User'})`
                    : waStatus.qr_gateway?.online
                    ? 'Gateway online, waiting for QR scan'
                    : 'Gateway offline (npm start in whatsapp-gateway/)'}
                </p>
              </div>
              <a href="/setup" className="btn-secondary text-xs py-1.5 px-3">
                {waStatus.qr_gateway?.connected ? 'Manage' : 'Scan QR Code'}
              </a>
            </div>

            <div className="space-y-1">
              <StatusIndicator ok={waStatus.qr_gateway?.connected || (!waStatus.demo_mode && waStatus.meta_api?.configured)} label={
                waStatus.qr_gateway?.connected
                  ? 'Connected via WhatsApp Web'
                  : waStatus.demo_mode
                  ? 'Demo Mode (simulated sending)'
                  : waStatus.meta_api?.configured
                  ? 'Connected via Meta Cloud API'
                  : 'No active connection. Connect via QR Code above!'
              } />
              <p className="text-xs text-gray-400 ml-6">Active Provider: {waStatus.provider || 'qr'}</p>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Send Test Message</p>
          <div className="space-y-3">
            <div>
              <label className="label">Phone Number</label>
              <input type="tel" className="input-field" placeholder="+919876543210"
                value={testPhone} onChange={e => setTestPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Message</label>
              <input type="text" className="input-field"
                value={testMsg} onChange={e => setTestMsg(e.target.value)} />
            </div>
            <button onClick={handleTestMessage} disabled={testing} className="btn-primary">
              {testing ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
              {testing ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Status */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">AI (Ollama) Status</h2>
        </div>
        {aiStatus === null ? <LoadingSpinner size="sm" /> : (
          <div className="space-y-2">
            <StatusIndicator ok={aiStatus.available} label={
              aiStatus.available ? 'Ollama is running' : 'Ollama not available (optional feature)'
            } />
            <p className="text-xs text-gray-400 ml-6">Configured model: {aiStatus.configured_model}</p>
            {aiStatus.available && (
              <p className="text-xs text-gray-400 ml-6">
                Model ready: {aiStatus.model_ready ? '✅ Yes' : '⚠️ Not loaded (run: ollama pull ' + aiStatus.configured_model + ')'}
              </p>
            )}
          </div>
        )}
        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <p className="text-xs text-purple-800 font-medium mb-1">Setup Ollama (optional)</p>
          <ol className="text-xs text-purple-700 space-y-1 list-decimal list-inside">
            <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noreferrer" className="underline">ollama.ai</a></li>
            <li>Run: <code className="bg-purple-100 px-1 rounded">ollama pull mistral:latest</code></li>
            <li>Ollama runs on port 11434 by default</li>
          </ol>
        </div>
      </div>

      {/* Env info */}
      <div className="card bg-gray-50 border-dashed">
        <p className="text-sm font-semibold text-gray-700 mb-2">📋 Environment Configuration</p>
        <p className="text-xs text-gray-500 mb-3">Configure these in <code className="bg-white px-1 rounded border">backend/.env</code></p>
        <div className="space-y-1 font-mono text-xs text-gray-500">
          {[
            'WHATSAPP_ACCESS_TOKEN=your_token',
            'WHATSAPP_PHONE_NUMBER_ID=your_phone_id',
            'WHATSAPP_VERIFY_TOKEN=your_verify_token',
            'MYSQL_HOST=localhost',
            'MYSQL_DATABASE=whatsapp_reminder',
          ].map(line => <p key={line} className="bg-white px-2 py-1 rounded border">{line}</p>)}
        </div>
      </div>
    </div>
  )
}

