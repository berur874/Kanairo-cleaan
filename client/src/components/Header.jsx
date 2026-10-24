import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_HOME, ROLE_LABELS } from '../auth/session.js';

// Each role only sees its own part of the app.
const ROLE_NAV = {
  seller: [['/dashboard', 'Dashboard'], ['/market', 'Marketplace'], ['/sell', 'Sell scrap'], ['/sell/history', 'My drop-offs']],
  buyer: [['/dashboard', 'Dashboard'], ['/market', 'Marketplace'], ['/buy', 'Buy materials'], ['/buy/orders', 'My orders']],
  hub_manager: [['/hub', 'My hub'], ['/market', 'Marketplace']],
};

const navClass = ({ isActive }) => (isActive ? 'active' : '');

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleLogout() {
    await logout().catch(() => {});
    navigate('/', { replace: true });
  }

  return (
    <header className={isScrolled ? 'scrolled' : ''}>
      <Link to={user ? ROLE_HOME[user.role] : '/'} className="brand">Kanairo Klean</Link>
      <nav className="navbar" aria-label="Main">
        <ul>
          {user ? (
            <>
              {ROLE_NAV[user.role].map(([to, label]) => (
                <li key={to}>
                  <NavLink to={to} end className={navClass}>{label}</NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/profile" className={({ isActive }) => `nav-user${isActive ? ' active' : ''}`} title="My profile">
                  <span>{user.name}</span>
                  <span className="nav-role">{ROLE_LABELS[user.role]} · Profile</span>
                </NavLink>
              </li>
              <li>
                <button type="button" className="nav-logout" onClick={handleLogout}>Log out</button>
              </li>
            </>
          ) : (
            <>
              <li><NavLink to="/" end className={navClass}>Home</NavLink></li>
              <li><NavLink to="/login" className={navClass}>Log in</NavLink></li>
              <li><Link to="/signup" className="btn btn-sm">Sign up</Link></li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
