const roleLabels = {
  admin: "Administrator",
  finance: "Finance",
  customer_support: "Customer service",
};

const formatRole = (role) => roleLabels[role] || "General staff";

function StaffSummary({ members }) {
  const active = members.filter((member) => !member.crm_closed_at).length;
  const finance = members.filter((member) => member.crm_role === "finance").length;
  const support = members.filter((member) => member.crm_role === "customer_support").length;
  return (
    <div className="staff-summary-grid">
      <div className="staff-summary-card"><span>Total staff</span><strong>{members.length}</strong><small>CRM accounts in this farm</small></div>
      <div className="staff-summary-card accent"><span>Active accounts</span><strong>{active}</strong><small>Currently able to sign in</small></div>
      <div className="staff-summary-card"><span>Departments</span><strong>{finance + support > 0 ? 2 : 0}</strong><small>{finance} finance, {support} customer service</small></div>
    </div>
  );
}

function StaffDirectory({ members, view, onUpdate, onDelete, isAdmin }) {
  const filtered = members.filter((member) => {
    if (view === "staff-finance") return member.crm_role === "finance";
    if (view === "staff-support") return member.crm_role === "customer_support";
    return true;
  });
  return (
    <section className="panel-card staff-workspace-panel">
      <div className="panel-heading"><div><div className="eyebrow">My staff</div><h2>{view === "staff-finance" ? "Finance team" : view === "staff-support" ? "Customer service team" : "Staff list"}</h2></div><span>{filtered.length} people</span></div>
      {filtered.length === 0 ? <div className="state-message">No staff accounts match this department.</div> : <div className="staff-directory-list">
        {filtered.map((member) => (
          <article className="staff-directory-row" key={member.id}>
            <span className="staff-avatar">{(member.name || "?").slice(0, 1).toUpperCase()}</span>
            <div className="staff-directory-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
            <span className="staff-role-badge">{formatRole(member.crm_role)}</span>
            <span className={`staff-status ${member.crm_closed_at ? "suspended" : "active"}`}>{member.crm_closed_at ? "Suspended" : "Active"}</span>
            {isAdmin && <div className="staff-directory-actions"><select aria-label={`Change role for ${member.name}`} value={member.crm_role || "customer_support"} onChange={(event) => onUpdate(member, { crm_role: event.target.value })}><option value="finance">Finance</option><option value="customer_support">Customer service</option></select><button className="filter-button" type="button" onClick={() => onUpdate(member, { closed: !member.crm_closed_at })}>{member.crm_closed_at ? "Reactivate" : "Suspend"}</button><button className="danger-button" type="button" onClick={() => onDelete(member)}>Delete</button></div>}
          </article>
        ))}
      </div>}
    </section>
  );
}

function PolicyViews({ policies, policyForm, setPolicyForm, onCreate, existing }) {
  if (!existing) return <section className="panel-card staff-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Staff policies</div><h2>New policy</h2></div><span>Set a clear expectation for the team</span></div><form className="policy-form" onSubmit={onCreate}><input required value={policyForm.title} onChange={(event) => setPolicyForm((current) => ({ ...current, title: event.target.value }))} placeholder="Policy title" /><select value={policyForm.audience} onChange={(event) => setPolicyForm((current) => ({ ...current, audience: event.target.value }))}><option value="all">All staff</option><option value="finance">Finance</option><option value="customer_support">Customer service</option></select><input type="date" required value={policyForm.effectiveDate} onChange={(event) => setPolicyForm((current) => ({ ...current, effectiveDate: event.target.value }))} /><textarea required rows="5" value={policyForm.summary} onChange={(event) => setPolicyForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Write the policy summary and expected staff action" /><button className="primary-button" type="submit">Publish policy</button></form></section>;
  return <section className="panel-card staff-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Staff policies</div><h2>Existing policies</h2></div><span>{policies.length} policies</span></div>{policies.length === 0 ? <div className="state-message">No policies have been published yet.</div> : <div className="policy-list">{policies.map((policy) => <article className="policy-row" key={policy.id}><div><strong>{policy.title}</strong><span>{policy.summary}</span></div><span className="staff-role-badge">{policy.audience === "all" ? "All staff" : formatRole(policy.audience)}</span><time>{policy.effectiveDate}</time></article>)}</div>}</section>;
}

function StaffLogs({ logs }) {
  return <section className="panel-card staff-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Staff logs</div><h2>System activity</h2></div><span>{logs.length} recent events</span></div>{logs.length === 0 ? <div className="state-message">Activity will appear here as staff use the CRM.</div> : <div className="staff-log-table">{logs.map((log) => <div className="staff-log-row" key={log.id}><strong>{log.staff}</strong><span>{log.action}</span><span>{log.module}</span><time>{new Date(log.at).toLocaleString()}</time></div>)}</div>}</section>;
}

export function StaffWorkspace({ view, members, policies, policyForm, setPolicyForm, onCreatePolicy, logs, onUpdate, onDelete, isAdmin }) {
  if (view === "policy-new") return <PolicyViews policies={policies} policyForm={policyForm} setPolicyForm={setPolicyForm} onCreate={onCreatePolicy} existing={false} />;
  if (view === "policy-existing") return <PolicyViews policies={policies} policyForm={policyForm} setPolicyForm={setPolicyForm} onCreate={onCreatePolicy} existing />;
  if (view === "staff-logs") return <StaffLogs logs={logs} />;
  return <><StaffSummary members={members} /><StaffDirectory members={members} view={view} onUpdate={onUpdate} onDelete={onDelete} isAdmin={isAdmin} /></>;
}
