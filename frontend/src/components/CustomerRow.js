import RiskBadge from './RiskBadge';

function CustomerRow({ customer, onSelect }) {
  return <button className="customer-row" onClick={() => onSelect(customer.id)} aria-label={`View ${customer.name}'s journey`}>
    <span className="avatar">{customer.name.slice(0, 1)}</span>
    <span className="customer-name">{customer.name}<small>{customer.id}</small></span>
    <RiskBadge score={customer.risk_score} />
    <span className="break-count"><b>{customer.break_count}</b> detected {customer.break_count === 1 ? 'break' : 'breaks'}</span>
    <span className="row-chevron">›</span>
  </button>;
}

export default CustomerRow;
