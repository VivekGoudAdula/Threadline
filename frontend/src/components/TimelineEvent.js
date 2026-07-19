import { useState } from 'react';

const channelIcons = { app: '◈', web: '◌', call_center: '☎', branch: '⌂' };

function TimelineEvent({ event, onReplay, replayStatus }) {
  const [expanded, setExpanded] = useState(false);
  const breaks = event.detected_breaks || [];
  const date = new Date(event.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return <article className={`timeline-event ${breaks.length ? 'flagged' : ''}`}>
    <div className="timeline-marker"><span>{channelIcons[event.channel] || '•'}</span></div>
    <div className="event-card">
      <div className="event-meta"><span className="channel-label">{event.channel.replace('_', ' ')}</span><time>{date}</time></div>
      <p>{event.description}</p>
      {breaks.length > 0 && <><div className="event-actions"><button className="flag-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Hide break analysis' : `View ${breaks.length} break ${breaks.length === 1 ? 'analysis' : 'analyses'}`} <span>{expanded ? '−' : '+'}</span></button><button className="replay-button" onClick={() => onReplay(event.event_id)} disabled={replayStatus === 'loading'}>{replayStatus === 'loading' ? 'Replaying…' : 'Replay with fix applied'} <span>↗</span></button></div>{expanded && <div className="break-explanation">{breaks.map((item) => <div key={item.type}><strong>{item.type.replace('_', ' ')}</strong><p>{item.explanation}</p></div>)}</div>}</>}
    </div>
  </article>;
}

export default TimelineEvent;
