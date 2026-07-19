import { useEffect, useState } from 'react';
import { IconActivity, IconAlertTriangle, IconLayoutDashboard, IconMenu2, IconSettings, IconX } from '@tabler/icons-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const navigation = [
  { label: 'Overview', path: '/', Icon: IconLayoutDashboard },
  { label: 'At-risk customers', path: '/customers', Icon: IconAlertTriangle, count: true },
  { label: 'Live feed', path: '/live', Icon: IconActivity },
  { label: 'Settings', path: '/settings', Icon: IconSettings },
];

function Layout({ path, navigate, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highRiskCount, setHighRiskCount] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/customers`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((customers) => setHighRiskCount(customers.filter((customer) => customer.risk_score >= 7).length))
      .catch(() => setHighRiskCount(null));
  }, []);

  const choosePage = (targetPath) => { navigate(targetPath); setDrawerOpen(false); };
  return <div className="application-layout">
    <button className="mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><IconMenu2 size={22} /></button>
    {drawerOpen && <button className="drawer-scrim" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="brand"><span>Journey Intelligence</span><strong>Threadline</strong><button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><IconX size={20} /></button></div>
      <nav className="sidebar-nav" aria-label="Primary navigation">{navigation.map(({ label, path: targetPath, Icon, count }) => <button key={targetPath} className={`nav-item ${path === targetPath ? 'active' : ''}`} onClick={() => choosePage(targetPath)}><Icon size={18} stroke={1.75} /><span>{label}</span>{count && highRiskCount !== null && <b>{highRiskCount}</b>}</button>)}</nav>
    </aside>
    <div className="content-pane">{children}</div>
  </div>;
}

export default Layout;
