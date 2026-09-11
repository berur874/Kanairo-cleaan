import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={isScrolled ? 'scrolled' : ''}>
      <p className="brand">Kanairo Klean</p>
      <nav className="navbar">
        <ul>
          <li>
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>
              About Us
            </NavLink>
          </li>
          <li>
            <NavLink to="/compliance" className={({ isActive }) => isActive ? 'active' : ''}>
              Compliance
            </NavLink>
          </li>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/marketplace" className={({ isActive }) => isActive ? 'active' : ''}>
              Marketplace
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}