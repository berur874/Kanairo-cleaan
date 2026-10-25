// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { ROLE_HOME } from './auth/session.js';
import RequireAuth from './auth/RequireAuth.jsx';
import Home from './pages/Home';
import { Login, Signup } from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Sell, { SellHistory } from './pages/Sell.jsx';
import Buy, { BuyOrders } from './pages/Buy.jsx';
import Dashboard from './pages/Dashboard';
import UserDashboard from './pages/UserDashboard.jsx';
import Market from './pages/Market.jsx';
import Profile from './pages/Profile.jsx';

// Logged-in users skip the landing page and go to their own part of the app.
function Landing() {
  const { user, checking } = useAuth();
  if (checking) return null;
  if (user) return <Navigate to={user.accessibility_needs === null ? '/onboarding' : ROLE_HOME[user.role]} replace />;
  return <Home />;
}

const only = (roles, page) => <RequireAuth roles={roles}>{page}</RequireAuth>;

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route path="/dashboard" element={only(['seller', 'buyer'], <UserDashboard />)} />
          <Route path="/market" element={only(null, <Market />)} />
          <Route path="/profile" element={only(null, <Profile />)} />
          <Route path="/sell" element={only(['seller'], <Sell />)} />
          <Route path="/sell/history" element={only(['seller'], <SellHistory />)} />
          <Route path="/buy" element={only(['buyer'], <Buy />)} />
          <Route path="/buy/orders" element={only(['buyer'], <BuyOrders />)} />
          <Route path="/hub" element={only(['hub_manager'], <Dashboard />)} />

          {/* Old website address */}
          <Route path="/marketplace" element={<Navigate to="/market" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </Router>
    </AuthProvider>
  );
}
