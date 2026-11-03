import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateReminder from './pages/CreateReminder'
import Reminders from './pages/Reminders'
import Contacts from './pages/Contacts'
import MessageHistory from './pages/MessageHistory'
import Settings from './pages/Settings'
import WhatsAppSetup from './pages/WhatsAppSetup'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="reminders/create" element={<CreateReminder />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="history" element={<MessageHistory />} />
        <Route path="setup" element={<WhatsAppSetup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
