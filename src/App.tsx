import { Navigate, Route, Routes } from 'react-router-dom'
import InvestorHub from './components/InvestorHub'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Auth from './pages/Auth'
import BuyerDashboard from './pages/BuyerDashboard'
import Community from './pages/Community'
import FarmerDashboard from './pages/FarmerDashboard'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import Marketplace from './pages/Marketplace'
import Messages from './pages/Messages'
import Support from './pages/Support'

function App() {
  return (
    <div className="min-h-screen bg-sand-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/community" element={<Community />} />
        <Route path="/support" element={<Support />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/invest" element={<InvestorHub />} />
        <Route path="/impact" element={<Navigate to="/invest" replace />} />
        <Route
          path="/farmer/dashboard"
          element={
            <ProtectedRoute role="farmer">
              <FarmerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buyer/dashboard"
          element={
            <ProtectedRoute role="buyer">
              <BuyerDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
