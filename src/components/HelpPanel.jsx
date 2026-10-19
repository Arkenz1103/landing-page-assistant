const EXAMPLES = [
  { type: 'Status', q: 'What is the status for Wagner Soil Testing?' },
  { type: 'Months with landing page URLs', q: 'Which months have landing page URLs for Wagner Soil Testing?' },
  { type: 'Months without landing page URLs', q: "Which months don't have landing page URLs for A Vision Windscreens?" },
  { type: 'Assigned to', q: 'Who is assigned to Bruin Pest Management?' },
  { type: 'Service and city', q: 'What is the service and city for Wagner Soil Testing?' },
  { type: 'GMB, Yellow Pages and True Local links', q: 'What is the GMB link for Bruin Pest Management?' },
  { type: 'Assigned Use Only', q: 'What is in Assigned Use Only for Wagner Soil Testing?' },
  { type: 'All clients', q: 'Show all clients' },
  { type: 'Plan', q: 'What plan is Wagner Soil Testing on?' },
  { type: 'Report link', q: 'What is the report link for Cuzkell?' },
  { type: 'Citations', q: 'What are the citations for Ace Restumping?' },
  { type: 'Reports not done', q: 'Which reports are not done yet?' },
  { type: 'Clients by assignee', q: 'Which clients is Johnny assigned to?' },
];

export default function HelpPanel({ onAsk }) {
  return (
    <div className="help-panel">
      <p>
        This assistant answers from the clients landing page workbook. Include the client’s name for client-specific
        questions, or ask about all clients (e.g. “Show all clients”).
      </p>
      <h3 className="group-label">Question types</h3>
      <ul className="help-list">
        {EXAMPLES.map((e) => (
          <li key={e.type}>
            <span className="help-type">{e.type}</span>
            <button type="button" className="help-example" onClick={() => onAsk(e.q)}>
              {e.q}
            </button>
          </li>
        ))}
      </ul>
      <p className="help-tip">
        <strong>Tip:</strong> If a name matches more than one client, the assistant will ask which one you mean.
      </p>
    </div>
  );
}
