import { useState, useEffect, useRef } from 'react'
import { whatsappAPI } from '../services/api'
import { LoadingSpinner, StatusBadge } from '../components/ui'
import {
  CheckCircle, XCircle, Send, QrCode, RefreshCw, LogOut,
  Smartphone, ShieldCheck, ChevronRight, Info, Copy, ExternalLink,
  KeyRound, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function WhatsAppSetup() {
  const [activeTab, setActiveTab] = useState('qr') // 'qr' | 'pairing' | 'meta'
  const [qrData, setQrData] = useState(null)
  const [status, setStatus] = useState(null)
  const [refreshingQr, setRefreshingQr] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('Welcome! WhatsApp Smart Reminder Agent is now connected.')
  const [sendingTest, setSendingTest] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Pairing code state
  const [pairPhone, setPairPhone] = useState('')
  const [pairCode, setPairCode] = useState(null)
  const [gettingCode, setGettingCode] = useState(false)

  const pollingRef = useRef(null)

  const loadStatusAndQr = async () => {
    try {
      const [statusRes, qrRes] = await Promise.allSettled([
        whatsappAPI.status(),
        whatsappAPI.qr()
      ])

      if (statusRes.status === 'fulfilled') {
        setStatus(statusRes.value.data.data)
      }
      if (qrRes.status === 'fulfilled') {
        setQrData(qrRes.value.data.data)
      }
    } catch (err) {
      console.error('Failed to load status/qr:', err)
    }
  }

  const handleManualRefresh = async () => {
    setRefreshingQr(true)
    try {
      await whatsappAPI.refreshQr()
      toast.success('Refreshing QR code...')
      setTimeout(loadStatusAndQr, 1000)
    } catch {
      toast.error('Failed to refresh QR')
    } finally {
      setRefreshingQr(false)
    }
  }

  const handleResetSession = async () => {
    if (!window.confirm('Resetting will clear temporary pairing files and generate a fresh code. Continue?')) return
    try {
      await whatsappAPI.reset()
      toast.success('Session reset! Generating fresh code...')
      setPairCode(null)
      setTimeout(loadStatusAndQr, 1500)
    } catch {
      toast.error('Failed to reset session')
    }
  }

  useEffect(() => {
    loadStatusAndQr()

    // Poll status & QR code every 3.5 seconds while not connected
    pollingRef.current = setInterval(async () => {
      try {
        const res = await whatsappAPI.status()
        const s = res.data.data
        setStatus(s)
        if (!s.qr_gateway?.connected) {
          const qRes = await whatsappAPI.qr()
          setQrData(qRes.data.data)
        }
      } catch (e) {
        // Gateway restarting
      }
    }, 3500)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp Web?')) return
    setLoggingOut(true)
    try {
      await whatsappAPI.logout()
      toast.success('WhatsApp disconnected successfully')
      setPairCode(null)
      await loadStatusAndQr()
    } catch (err) {
      toast.error('Logout failed')
    } finally {
      setLoggingOut(false)
    }
  }

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a phone number with country code (e.g., +919876543210)')
      return
    }
    setSendingTest(true)
    try {
      const res = await whatsappAPI.test({ phone_number: testPhone, message: testMessage })
      if (res.data.success) {
        toast.success('Test message sent successfully via WhatsApp!')
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send message'
      toast.error(msg)
    } finally {
      setSendingTest(false)
    }
  }

  const handleGetPairingCode = async (e) => {
    e.preventDefault()
    if (!pairPhone.trim()) {
      toast.error('Enter your WhatsApp phone number with country code')
      return
    }
    setGettingCode(true)
    setPairCode(null)
    try {
      const res = await whatsappAPI.pairingCode({ phone: pairPhone })
      const code = res.data?.data?.code
      if (code) {
        setPairCode(code)
        toast.success('Pairing code generated!')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate pairing code')
    } finally {
      setGettingCode(false)
    }
  }

  const isQrConnected = status?.qr_gateway?.connected
  const isGatewayOnline = status?.qr_gateway?.online
  const isExpired = qrData?.isExpired

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Connection & Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your WhatsApp — scan the QR code, link using a phone pairing code, or configure Meta Cloud API
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'qr'
              ? 'border-green-600 text-green-700 bg-green-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <QrCode className="w-4 h-4" />
          QR Code Scan
          {isQrConnected && (
            <span className="w-2 h-2 rounded-full bg-green-500 ml-1 inline-block animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pairing')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'pairing'
              ? 'border-green-600 text-green-700 bg-green-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Link with Phone Number Code
        </button>

        <button
          onClick={() => setActiveTab('meta')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'meta'
              ? 'border-green-600 text-green-700 bg-green-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Meta Cloud API (Official / Developer)
        </button>
      </div>

      {/* Status banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
        isQrConnected
          ? 'bg-green-50 border-green-200'
          : isGatewayOnline
          ? 'bg-blue-50 border-blue-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isQrConnected ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {isQrConnected
                ? 'WhatsApp is Connected ✅'
                : isGatewayOnline
                ? 'Ready to Connect'
                : 'Starting WhatsApp Gateway...'}
            </p>
            <p className="text-xs text-gray-500">
              {isQrConnected
                ? `Active Number: +${status?.qr_gateway?.phone || ''} (${status?.qr_gateway?.name || 'User'})`
                : isGatewayOnline
                ? 'Scan the QR code or use the 8-digit phone pairing code below'
                : 'Ensure "npm start" in whatsapp-gateway/ is running'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isQrConnected && (
            <>
              <button
                onClick={handleManualRefresh}
                disabled={refreshingQr}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Refresh QR Code"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingQr ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleResetSession}
                className="btn-secondary text-xs py-1.5 px-3 text-gray-500 hover:text-red-600"
                title="Reset session files and start completely fresh"
              >
                Reset Session
              </button>
            </>
          )}
          {isQrConnected && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: QR CODE LOGIN */}
      {activeTab === 'qr' && (
        <div className="space-y-6">
          {!isQrConnected ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="card p-6 flex flex-col items-center justify-center text-center bg-white border shadow-sm rounded-2xl min-h-[350px]">
                {qrData?.qr ? (
                  <div className="space-y-3">
                    <div className="relative p-3 bg-white border-2 border-green-500/30 rounded-2xl shadow-inner inline-block">
                      <img
                        src={qrData.qr}
                        alt="WhatsApp QR Code"
                        className={`w-64 h-64 mx-auto object-contain transition-opacity duration-300 ${
                          isExpired ? 'opacity-25 filter blur-[1px]' : 'opacity-100'
                        }`}
                      />

                      {isExpired && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-white/70 rounded-2xl">
                          <AlertCircle className="w-8 h-8 text-amber-600 mb-2" />
                          <p className="text-xs font-semibold text-gray-800">QR Code Expired</p>
                          <p className="text-[11px] text-gray-500 mb-3 text-center">
                            QR code was not scanned within 2 minutes
                          </p>
                          <button
                            onClick={handleManualRefresh}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Click to Reload
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500">
                      ℹ️ This QR code remains valid for 2 minutes. Scan with your WhatsApp camera now.
                    </p>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center space-y-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm font-medium text-gray-600">Generating QR Code...</p>
                    <p className="text-xs text-gray-400 max-w-xs">
                      Make sure <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">npm start</code> is running in whatsapp-gateway/
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="card p-6 space-y-4 bg-gray-50/50 border rounded-2xl">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  How to Scan & Connect:
                </h3>
                <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
                  <li className="leading-relaxed">
                    Open <strong>WhatsApp</strong> on your mobile phone.
                  </li>
                  <li className="leading-relaxed">
                    Tap the <strong>three dots (⋮) menu</strong> on Android or <strong>Settings</strong> on iPhone.
                  </li>
                  <li className="leading-relaxed">
                    Select <strong>Linked Devices</strong>.
                  </li>
                  <li className="leading-relaxed">
                    Tap <strong>Link a Device</strong> and point your camera at the <strong>QR code on the left</strong>.
                  </li>
                </ol>

                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 space-y-1">
                  <p className="font-semibold">✨ Don't want to use the camera?</p>
                  <p>
                    Switch to the <strong>"Link with Phone Number Code"</strong> tab above to get an 8-digit code instead!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ConnectedSection
              testPhone={testPhone}
              setTestPhone={setTestPhone}
              testMessage={testMessage}
              setTestMessage={setTestMessage}
              handleSendTest={handleSendTest}
              sendingTest={sendingTest}
            />
          )}
        </div>
      )}

      {/* TAB 2: LINK WITH PHONE NUMBER PAIRING CODE */}
      {activeTab === 'pairing' && (
        <div className="space-y-6">
          {!isQrConnected ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="card p-6 space-y-4 bg-white border rounded-2xl shadow-sm">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-green-600" />
                  Link Using 8-Digit Pairing Code
                </h3>
                <p className="text-xs text-gray-500">
                  No camera needed! Type your WhatsApp phone number to generate an 8-digit pairing code.
                </p>

                <form onSubmit={handleGetPairingCode} className="space-y-3">
                  <div>
                    <label className="label">Your WhatsApp Phone Number (with Country Code)</label>
                    <input
                      type="tel"
                      className="input-field font-mono"
                      placeholder="+919876543210 or +1234567890"
                      value={pairPhone}
                      onChange={e => setPairPhone(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={gettingCode}
                    className="btn-primary w-full justify-center"
                  >
                    {gettingCode ? <LoadingSpinner size="sm" /> : <KeyRound className="w-4 h-4" />}
                    {gettingCode ? 'Generating Code...' : 'Get Pairing Code'}
                  </button>
                </form>

                {pairCode && (
                  <div className="p-4 bg-green-50 border-2 border-green-500/40 rounded-xl text-center space-y-2">
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                      Your 8-Digit Pairing Code
                    </p>
                    <div className="text-2xl font-mono font-bold tracking-widest text-green-700 bg-white py-2 px-4 rounded-lg border border-green-200 inline-block">
                      {pairCode}
                    </div>
                    <p className="text-xs text-gray-500">
                      Enter this code in WhatsApp on your phone within 60 seconds
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions for Pairing Code */}
              <div className="card p-6 space-y-4 bg-gray-50/50 border rounded-2xl">
                <h3 className="font-bold text-gray-900">How to enter code on phone:</h3>
                <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
                  <li>Open <strong>WhatsApp</strong> on your phone.</li>
                  <li>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong> → <strong>Linked Devices</strong>.</li>
                  <li>Tap <strong>Link a Device</strong>.</li>
                  <li>At the bottom of the camera screen, tap <strong>"Link with phone number instead"</strong>.</li>
                  <li>Enter the 8-digit code shown here.</li>
                </ol>
              </div>
            </div>
          ) : (
            <ConnectedSection
              testPhone={testPhone}
              setTestPhone={setTestPhone}
              testMessage={testMessage}
              setTestMessage={setTestMessage}
              handleSendTest={handleSendTest}
              sendingTest={sendingTest}
            />
          )}
        </div>
      )}

      {/* TAB 3: META CLOUD API (Official) */}
      {activeTab === 'meta' && (
        <div className="card p-6 space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 text-sm text-blue-800">
            <Info className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">Official Meta WhatsApp Cloud API:</p>
              <p className="mt-1 text-xs text-blue-700 leading-relaxed">
                This is Meta's official business messaging solution. You will need a Facebook Developer account,
                a <strong>Permanent Access Token</strong>, and a <strong>Phone Number ID</strong> configured in your <code>backend/.env</code> file.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Meta API Credentials</h3>
            <p className="text-xs text-gray-500">
              Configure these variables in your <code>backend/.env</code> file:
            </p>
            <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-xl space-y-1">
              <p>WHATSAPP_PROVIDER=meta</p>
              <p>WHATSAPP_ACCESS_TOKEN=your_meta_access_token_here</p>
              <p>WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id</p>
              <p>WHATSAPP_VERIFY_TOKEN=my_custom_verify_token</p>
              <p>DEMO_MODE=False</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border space-y-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Webhook Callback URL:</p>
            <code className="block p-2 bg-white rounded border font-mono text-gray-700">
              {window.location.protocol}//{window.location.hostname}:5000/api/whatsapp/webhook
            </code>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectedSection({
  testPhone,
  setTestPhone,
  testMessage,
  setTestMessage,
  handleSendTest,
  sendingTest
}) {
  return (
    <div className="card p-6 space-y-5 bg-white border rounded-2xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">WhatsApp is Successfully Connected!</h3>
          <p className="text-xs text-gray-500">You can now schedule reminders and send test messages to any phone number</p>
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h4 className="font-semibold text-sm text-gray-800">Send a Quick Test Message</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Recipient WhatsApp Number (with country code)</label>
            <input
              type="tel"
              className="input-field font-mono"
              placeholder="+1234567890 or +919876543210"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Test Message</label>
            <input
              type="text"
              className="input-field"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            className="btn-primary"
          >
            {sendingTest ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
            Send Test Message
          </button>
        </div>
      </div>
    </div>
  )
}
