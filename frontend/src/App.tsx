import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import AdminPage from './pages/AdminPage'
import EventDetailPage from './pages/EventDetailPage'
import ClubsPage from './pages/ClubsPage'
import ClubDetailPage from './pages/ClubDetailPage'
import AlbumPage from './pages/AlbumPage'
import SearchPage from './pages/SearchPage'
import FaceSearchPage from './pages/FaceSearchPage'
import FavouritesPage from './pages/FavouritesPage'
import LoadingSpinner from './components/ui/LoadingSpinner'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />

  return (
    <div className="app-canvas min-h-screen text-college-black">
      <Navbar />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
        <Route path="/admin"  element={<PrivateRoute><AdminPage /></PrivateRoute>} />
        <Route path="/clubs" element={<PrivateRoute><ClubsPage /></PrivateRoute>} />
        <Route path="/clubs/:slug" element={<PrivateRoute><ClubDetailPage /></PrivateRoute>} />
        <Route path="/events/:id" element={<PrivateRoute><EventDetailPage /></PrivateRoute>} />
        <Route path="/events/:id/albums/:albumId" element={<PrivateRoute><AlbumPage /></PrivateRoute>} />
        <Route path="/search" element={<PrivateRoute><SearchPage /></PrivateRoute>} />
        <Route path="/find-my-photos" element={<PrivateRoute><FaceSearchPage /></PrivateRoute>} />
        <Route path="/favourites" element={<PrivateRoute><FavouritesPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}
