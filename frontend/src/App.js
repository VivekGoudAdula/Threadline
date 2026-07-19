import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './App.css';
import Layout from './components/Layout';
import CustomerList from './components/CustomerList';
import TimelineEvent from './components/TimelineEvent';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const LIVE_EVENT_POOL = [
  { customer: 'cust_024', channel: 'app', description: 'Viewed purchase-protection coverage details.' },
  { customer: 'cust_113', channel: 'web', description: 'Reviewed purchase-protection fee quote of $45.' },
  { customer: 'cust_024', channel: 'call center', description: 'Support stated the customer is not eligible for coverage.', breakType: 'contradiction' },
  { customer: 'cust_078', channel: 'branch', description: 'Asked a branch associate for claim status.' },
  { customer: 'cust_191', channel: 'app', description: 'Received a purchase-protection fee quote of $60.' },
  { customer: 'cust_191', channel: 'web', description: 'Received a second fee quote of $45.', breakType: 'fee_mismatch' },
  { customer: 'cust_066', channel: 'call center', description: 'Contacted support about an unresolved purchase-protection issue.' },
  { customer: 'cust_066', channel: 'branch', description: 'Made a third unresolved contact in seven days.', breakType: 'repeat_contact' },
  { customer: 'cust_147', channel: 'web', description: 'Checked a previously resolved claim journey.' },
];

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  const customerId = path.match(/^\/customer\/([^/]+)$/)?.[1];
  let page;
  if (customerId) page = <TimelinePage customerId={customerId} navigate={navigate} />;
  else if (path === '/live') page = <LivePage navigate={navigate} />;
  else if (path === '/settings') page = <SettingsPage navigate={navigate} />;
  else page = path === '/customers' ? <CustomersPage navigate={navigate} /> : <OverviewPage navigate={navigate} />;
  return <Layout path={path} navigate={navigate}>{page}</Layout>;
}

function CustomersPage({ navigate }) {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch(`${API_BASE_URL}/customers`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load customers.'))))
      .then((data) => { setCustomers(data); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main className="app-shell">
      <Header eyebrow="Journey intelligence" title="At-risk customers" description="Find customers whose journey is starting to break — before the next contact." />
      {status === 'loading' && <Loading label="Loading customer risk signals…" />}
      {status === 'error' && <EmptyState title="Customer signals are unavailable" message="Check that the Threadline API is running on localhost:8000." />}
      {status === 'ready' && <CustomerList customers={customers} onSelect={(id) => navigate(`/customer/${id}`)} />}
    </main>
  );
}

function OverviewPage({ navigate }) {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch(`${API_BASE_URL}/customers`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load dashboard.'))))
      .then((data) => { setCustomers(data); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <main className="app-shell"><Loading label="Calculating journey health…" /></main>;
  if (status === 'error') return <main className="app-shell"><EmptyState title="Dashboard unavailable" message="Check that the Threadline API is running on localhost:8000." /></main>;

  const total = customers.length;
  const withBreaks = customers.filter((customer) => customer.break_count > 0);
  const averageRisk = total ? customers.reduce((sum, customer) => sum + customer.risk_score, 0) / total : 0;
  const highChurn = customers.filter((customer) => customer.risk_score >= 7).length;
  const distribution = ['fee_mismatch', 'repeat_contact', 'contradiction'].map((type) => ({
    name: type.replace('_', ' '),
    count: customers.filter((customer) => customer.break_types.includes(type)).length,
  }));

  return <main className="app-shell overview-shell">
    <Header eyebrow="Executive overview" title="Threadline Analyst Control Room" description="A single view of cross-channel journey risk and the customers who need intervention." />
    <section className="stat-grid">
      <StatCard label="Customers monitored" value={total} detail="Active journeys in view" />
      <StatCard label="Detected journey breaks" value={`${total ? Math.round((withBreaks.length / total) * 100) : 0}%`} detail={`${withBreaks.length} customers need attention`} tone="alert" />
      <StatCard label="Average risk score" value={averageRisk.toFixed(1)} detail="Across all monitored customers" />
      <StatCard label="High churn risk" value={highChurn} detail="Risk score of 7 or higher" tone="critical" />
    </section>
    <section className="overview-lower">
      <div className="chart-card"><div className="card-kicker">Root-cause view</div><h2>What is breaking the journey?</h2><p>Break types across all monitored customer timelines.</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: '#5B6572', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#5B6572', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F7F5F0' }} contentStyle={{ border: '1px solid #E4E0D6', borderRadius: 6 }} /><Bar dataKey="count" name="Customers affected" fill="#0B1E3D" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      <aside className="business-case"><div className="card-kicker">Next best action</div><h2>Turn risk signals into retained customers.</h2><p>Start with the highest-risk journeys, then use counterfactual replay to show the likely impact of fixing the break.</p><div className="overview-actions"><button className="primary-action" onClick={() => navigate('/customers')}>View at-risk customers <span>→</span></button><button className="live-link" onClick={() => navigate('/live')}>Open live monitor <span>↗</span></button><button className="live-link" onClick={() => navigate('/settings')}>Risk model settings <span>⚙</span></button></div></aside>
    </section>
  </main>;
}

function StatCard({ label, value, detail, tone = 'normal' }) { return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }

function LivePage({ navigate }) {
  const [events, setEvents] = useState(() => LIVE_EVENT_POOL.slice(0, 3).map((event, index) => ({ ...event, id: `initial-${index}`, timestamp: new Date(Date.now() - (3 - index) * 5500) })));
  const poolIndex = useRef(3);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const template = LIVE_EVENT_POOL[poolIndex.current % LIVE_EVENT_POOL.length];
      const incoming = { ...template, id: `live-${Date.now()}`, timestamp: new Date(), fresh: true };
      setEvents((current) => [incoming, ...current].slice(0, 18));
      poolIndex.current += 1;
      if (template.breakType) {
        setToast({ customer: template.customer, type: template.breakType });
        window.setTimeout(() => setToast(null), 4200);
      }
    }, 2400);
    return () => window.clearInterval(interval);
  }, []);

  return <main className="app-shell live-shell"><button className="back-link" onClick={() => navigate('/')}>← Executive overview</button><Header eyebrow="Continuous monitoring" title="Live journey signal feed" description="New cross-channel events are being evaluated as they arrive." /><div className="live-layout"><section className="feed-card"><div className="feed-header"><div><span className="live-indicator"><i /> Live stream</span><p>Streaming synthetic event telemetry</p></div><span className="feed-count">{events.length} recent events</span></div><div className="event-feed">{events.map((event) => <article className={`live-event ${event.fresh ? 'fresh' : ''}`} key={event.id}><span className="live-channel">{event.channel}</span><div><strong>{event.customer}</strong><p>{event.description}</p></div><time>{event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></article>)}</div></section><aside className="monitor-note"><div className="card-kicker">Always on</div><h2>Watch the stitch happen.</h2><p>Threadline evaluates each arriving event against the customer’s recent cross-channel context. When a pattern completes, the analyst gets an immediate signal.</p><div><span>Monitoring cadence</span><strong>Every 2.4 seconds</strong></div></aside></div>{toast && <div className="break-toast" role="status"><span>⚡</span><div><small>New break detected</small><strong>{toast.customer} — {toast.type.replace('_', ' ')}</strong></div></div>}</main>;
}

function SettingsPage({ navigate }) {
  const [weights, setWeights] = useState({ contradiction: 4, fee_mismatch: 3, repeat_contact: 2 });
  const [lastRecalculated, setLastRecalculated] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch(`${API_BASE_URL}/settings`).then((response) => (response.ok ? response.json() : Promise.reject(new Error()))).then((data) => { setWeights(data.weights); setLastRecalculated(data.last_recalculated); setStatus('ready'); }).catch(() => setStatus('error'));
  }, []);

  const updateWeight = (key, value) => setWeights((current) => ({ ...current, [key]: Math.max(0, Math.min(10, Number(value))) }));
  const recalculate = () => {
    setStatus('saving');
    fetch(`${API_BASE_URL}/settings/recalculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(weights) }).then((response) => (response.ok ? response.json() : Promise.reject(new Error()))).then((data) => { setWeights(data.weights); setLastRecalculated(data.last_recalculated); setStatus('saved'); }).catch(() => setStatus('error'));
  };

  return <main className="app-shell settings-shell"><button className="back-link" onClick={() => navigate('/')}>← Executive overview</button><Header eyebrow="Model controls" title="Risk scoring settings" description="Tune the relative weight of each journey break for this in-memory prototype." />{status === 'loading' ? <Loading label="Loading risk model settings…" /> : <section className="settings-card"><div className="settings-intro"><h2>Break-point weights</h2><p>Higher weights raise the risk priority for that type of detected break. Changes apply to all 200 customer journeys immediately.</p></div><div className="weight-controls"><WeightControl label="Contradiction" value={weights.contradiction} onChange={(value) => updateWeight('contradiction', value)} /><WeightControl label="Fee mismatch" value={weights.fee_mismatch} onChange={(value) => updateWeight('fee_mismatch', value)} /><WeightControl label="Repeat unresolved contact" value={weights.repeat_contact} onChange={(value) => updateWeight('repeat_contact', value)} /></div><div className="settings-footer"><div className="recalculated-at">{lastRecalculated ? <>Last recalculated: <strong>{new Date(lastRecalculated).toLocaleString()}</strong></> : 'Not recalculated in this session'}</div><button className="primary-action" onClick={recalculate} disabled={status === 'saving'}>{status === 'saving' ? 'Recalculating…' : 'Recalculate all risk scores'} <span>↻</span></button></div>{status === 'saved' && <p className="settings-success">All customer risk scores have been recalculated.</p>}{status === 'error' && <p className="replay-error">Unable to update risk settings. Check that the API is running.</p>}</section>}</main>;
}

function WeightControl({ label, value, onChange }) { return <div className="weight-control"><div><label>{label}</label><small>Impact on the 0–10 risk score</small></div><input type="range" min="0" max="10" value={value} onChange={(event) => onChange(event.target.value)} /><input className="weight-number" type="number" min="0" max="10" value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label} weight`} /></div>; }

function TimelinePage({ customerId, navigate }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch(`${API_BASE_URL}/timeline/${customerId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Timeline unavailable.'))))
      .then((timeline) => { setData(timeline); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, [customerId]);

  return (
    <main className="app-shell">
      <button className="back-link" onClick={() => navigate('/')}>← All customers</button>
      {status === 'loading' && <Loading label="Stitching the customer journey…" />}
      {status === 'error' && <EmptyState title="Timeline not found" message="This customer may not exist, or the API is unavailable." />}
      {status === 'ready' && data && (
        <>
          <Header eyebrow="Stitched customer journey" title={data.customer_id} description={`${data.event_count} events across channels`} riskScore={data.risk_score} />
          {data.timeline.length === 0 ? <EmptyState title="No journey events" message="There are no events to stitch for this customer." /> : <JourneyTimeline customerId={customerId} timeline={data.timeline} />}
        </>
      )}
    </main>
  );
}

function JourneyTimeline({ customerId, timeline }) {
  const [replay, setReplay] = useState(null);
  const [replayStatus, setReplayStatus] = useState('idle');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const runReplay = (eventId) => {
    setSelectedEventId(eventId);
    setReplayStatus('loading');
    fetch(`${API_BASE_URL}/replay/${customerId}`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Replay unavailable.'))))
      .then((result) => { setReplay(result); setReplayStatus('ready'); })
      .catch(() => setReplayStatus('error'));
  };
  return <><section className="timeline">{timeline.map((event) => <TimelineEvent key={event.event_id} event={event} onReplay={runReplay} replayStatus={replayStatus} />)}</section>{replayStatus === 'error' && <p className="replay-error">Counterfactual replay is currently unavailable.</p>}{replay && <ReplayModal replay={replay} eventId={selectedEventId} onClose={() => setReplay(null)} />}</>;
}

function ReplayModal({ replay, eventId, onClose }) {
  const originalEvent = replay.original.timeline.find((event) => event.event_id === eventId);
  const fixedEvent = replay.fixed.timeline.find((event) => event.event_id === eventId);
  return <div className="replay-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="replay-modal" role="dialog" aria-modal="true" aria-labelledby="replay-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close replay comparison">×</button><div className="replay-eyebrow">Counterfactual replay · modeled intervention</div><div className="replay-heading"><div><h2 id="replay-title">What if this break had been fixed?</h2><p>Compare the original interaction with the projected corrected journey.</p></div><span className="fix-pill">Fix: {replay.applied_fix.replace('_', ' ')}</span></div><div className="event-comparison"><EventVersion label="Before" event={originalEvent} score={replay.original.risk_score} mode="before" /><div className="comparison-arrow">→</div><EventVersion label="After" event={fixedEvent} score={replay.fixed.risk_score} mode="after" /></div><div className="outcome-panel"><span>Projected outcome</span><strong>{replay.projected_outcome}</strong><small>Confidence: modeled projection based on synthetic data patterns</small></div></section></div>;
}

function EventVersion({ label, event, score, mode }) { return <article className={`event-version ${mode}`}><div className="version-heading"><span>{label}</span><div className="version-score"><small>Journey risk</small><strong>{score}<i>/10</i></strong></div></div><div className="version-event"><span className="version-channel">{event?.channel.replace('_', ' ')}</span><p>{event?.description}</p></div></article>; }

function Header({ eyebrow, title, description, riskScore }) {
  return <header className="page-header"><p className="eyebrow">{eyebrow}</p><div className="heading-row"><div><h1 className={title.startsWith('cust_') ? 'mono' : ''}>{title}</h1><p className="subtitle">{description}</p></div>{riskScore !== undefined && <div className="score-panel"><span>Journey risk</span><strong>{riskScore}<small>/10</small></strong></div>}</div></header>;
}

function Loading({ label }) { return <div className="state-card"><span className="spinner" />{label}</div>; }
function EmptyState({ title, message }) { return <div className="state-card empty-state"><h2>{title}</h2><p>{message}</p></div>; }

export default App;
