function RiskBadge({ score }) {
  const level = score >= 3 ? 'high' : score > 0 ? 'medium' : 'low';
  const label = level === 'high' ? 'High risk' : level === 'medium' ? 'Medium risk' : 'Low risk';
  return <span className={`risk-badge ${level}`}><i />{label}<b>{score}</b></span>;
}

export default RiskBadge;
