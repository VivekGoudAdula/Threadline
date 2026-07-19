import CustomerRow from './CustomerRow';

function CustomerList({ customers, onSelect }) {
  if (customers.length === 0) return <div className="state-card empty-state"><h2>No customers yet</h2><p>Customer journeys will appear here when events arrive.</p></div>;
  return <section className="customer-list" aria-label="Customers ranked by journey risk">
    <div className="list-caption"><span>Customer</span><span>Risk signal</span><span>Break points</span></div>
    {customers.map((customer) => <CustomerRow key={customer.id} customer={customer} onSelect={onSelect} />)}
  </section>;
}

export default CustomerList;
