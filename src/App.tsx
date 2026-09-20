import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Loading } from './components/bits'
import { AuthProvider, useAuth } from './lib/auth'
import { configured } from './lib/supabase'
import { Account } from './pages/Account'
import { Decisions } from './pages/Decisions'
import { BlueprintPage, ReportPage, ReportsList } from './pages/DocView'
import { Login } from './pages/Login'
import { Manage } from './pages/Manage'
import { Overview } from './pages/Overview'
import { Progress } from './pages/Progress'
import { Questions } from './pages/Questions'
import { NoAccess, NotConfigured, NotFound, ProblemScreen } from './pages/Screens'

// Everything except the sign-in page sits behind this. It decides which screen a person sees.
function Gate() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="center-screen">
        <Loading />
      </div>
    )
  }
  if (status === 'signedOut') {
    // After signing out from the account page, the next sign-in should land on the overview,
    // not straight back on the account page.
    const from = location.pathname === '/account' ? '/' : location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }
  if (status === 'noAccess') return <NoAccess />
  if (status === 'error') return <ProblemScreen />
  return <Layout />
}

export default function App() {
  if (!configured) return <NotConfigured />
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Gate />}>
            <Route index element={<Overview />} />
            <Route path="blueprint" element={<BlueprintPage />} />
            <Route path="progress" element={<Progress />} />
            <Route path="reports" element={<ReportsList />} />
            <Route path="reports/:slug" element={<ReportPage />} />
            <Route path="questions" element={<Questions />} />
            <Route path="decisions" element={<Decisions />} />
            <Route path="manage" element={<Manage />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
