const EXAMPLES = [
  { type: 'Status', q: 'Where are we at for Wagner Soil Testing?' },
  { type: 'Landing pages (optionally add a month)', q: 'Show the September landing pages for Wagner Soil Testing' },
  { type: 'Months with / without pages', q: "Which months don't have landing pages for A Vision Windscreens?" },
  { type: 'Assigned to', q: 'Who is assigned to Bruin Pest Management?' },
  { type: 'Service / City', q: 'What is the service and city for Wagner Soil Testing?' },
  { type: 'GMB / Yellow Pages / True Local link', q: 'What is the GMB link for Bruin Pest Management?' },
  { type: 'Assigned Use Only', q: 'What is in Assigned Use Only for Wagner Soil Testing?' },
];

export default function HelpPanel({ onAsk }) {
  return (
    <div className="help-panel">
      <p>This assistant answers from the client landing page sheet. Always include a client name.</p>
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
        <strong>Tip:</strong> If a name matches several clients, it will ask which one you mean.
      </p>
    </div>
  );
}
