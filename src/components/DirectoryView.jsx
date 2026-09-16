function roleLabel(role) {
  return { farmOwner: "Farm Owner", farmManager: "Farm Manager", farmWorker: "Farm Worker" }[role] || role || "-";
}

function DirectoryTable({ rows }) {
  if (!rows.length) return <div className="state-message">No members match this directory.</div>;
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Farm</th><th>Contact</th><th>Role</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.farm_id}-${row.id}`}><td><strong>{row.name}</strong></td><td>{row.farm_name || "-"}</td><td><span>{row.email || "-"}</span><small>{row.phone || ""}</small></td><td>{roleLabel(row.role)}</td><td><span className={`status-label ${row.status === "active" ? "won" : "lost"}`}>{row.status || "active"}</span></td></tr>)}</tbody></table></div>;
}

function RelationshipTable({ rows }) {
  return <section className="panel-card directory-panel"><div className="panel-heading"><div><div className="eyebrow">Farm relationships</div><h2>Farm ownership and team</h2></div><span>{rows.length} farms</span></div>{rows.length === 0 ? <div className="state-message">No accessible farms found.</div> : <div className="relationship-list">{rows.map((row) => <article className="relationship-row" key={row.farm_id}><div><strong>{row.farm_name}</strong><small>Owner: {row.owner?.name || "Not assigned"}</small></div><div><span>Managers</span><strong>{row.managers?.map((member) => member.name).join(", ") || "None"}</strong></div><div><span>Workers</span><strong>{row.workers?.length ? `${row.workers.length} assigned` : "None"}</strong></div></article>)}</div>}</section>;
}

export function DirectoryView({ view, directory, loading, error, onRefresh }) {
  const labels = { "farm-owners": "Farm Owners", "farm-managers": "Farm Managers", "farm-workers": "Farm Workers", relationships: "Relationships" };
  if (loading && !directory) return <section className="panel-card directory-panel"><div className="eyebrow">Customer directory</div><h2>Loading {labels[view]}</h2><p className="directory-help">Fetching all accessible farms and members.</p></section>;
  if (error && !directory) return <section className="panel-card directory-panel"><div className="eyebrow">Customer directory</div><h2>Directory unavailable</h2><p className="directory-help">{error}</p><button className="primary-button" type="button" onClick={onRefresh}>Try again</button></section>;
  if (!directory) return <section className="panel-card directory-panel"><h2>{labels[view]}</h2><div className="state-message">No directory data available.</div></section>;
  if (view === "relationships") return <RelationshipTable rows={directory.relationships || []} />;
  const rows = directory[view.replace("-", "_")] || [];
  return <section className="panel-card directory-panel"><div className="panel-heading"><div><div className="eyebrow">Customer directory</div><h2>{labels[view]}</h2></div><div className="directory-actions"><span>{rows.length} members</span><button className="filter-button" type="button" onClick={onRefresh}>Refresh</button></div></div><DirectoryTable rows={rows} /></section>;
}
