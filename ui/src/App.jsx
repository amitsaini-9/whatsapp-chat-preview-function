import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Chat from './pages/Chat';
import CreateTemplate from './pages/CreateTemplate';
import ManageTemplates from './pages/ManageTemplates';
import { MessageSquare, LayoutTemplate, FilePlus2, Lock } from 'lucide-react';
import './App.css';

const Navbar = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Chat', icon: <MessageSquare size={20} /> },
    { path: '/create-template', label: 'Create Template', icon: <FilePlus2 size={20} /> },
    { path: '/manage-templates', label: 'Manage Templates', icon: <LayoutTemplate size={20} /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem('wa_auth_token');
    window.location.reload();
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>WhatsApp Manager</h2>
      </div>
      <div className="navbar-links" style={{ flex: 1 }}>
        {navItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="navbar-footer" style={{ padding: '10px' }}>
        <button 
          onClick={handleLogout} 
          style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text)' }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

const AuthWrapper = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('wa_auth_token') === 'a8075DBF@1') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'a8075DBF@1') {
      localStorage.setItem('wa_auth_token', password);
      setIsAuthenticated(true);
    } else {
      setError('Invalid password');
    }
  };

  if (isAuthenticated) {
    return children;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: 'var(--primary)' }}>
          <Lock size={48} />
        </div>
        <h2 style={{ marginBottom: '25px', color: 'var(--text)' }}>WhatsApp Manager Login</h2>
        <form onSubmit={handleLogin}>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => { setPassword(e.target.value); setError(''); }} 
            placeholder="Enter password" 
            style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />
          {error && <div style={{ color: 'red', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
          <button type="submit" className="primary-btn" style={{ width: '100%', justifyContent: 'center' }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthWrapper>
      <Router>
        <div className="app-root">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/create-template" element={<CreateTemplate />} />
              <Route path="/manage-templates" element={<ManageTemplates />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthWrapper>
  );
}

export default App;
