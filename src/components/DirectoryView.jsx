import { useState } from "react";

function roleLabel(role) {
  return { farmOwner: "Farm Owner", farmManager: "Farm Manager", farmWorker: "Farm Worker" }[role] || role || "-";
}

function DirectoryTable({ rows }) {
  if (!rows.length) return <div className="state-message">No members match this directory.</div>;
  return <div className="data-table-wrap directory-grid-table"><table className="data-table"><thead><tr><th>Name</th><th>Farm name</th><th>Phone number</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.farm_id}-${row.id}`}><td><strong>{row.name}</strong></td><td>{row.farm_name || "-"}</td><td>{row.phone || "-"}</td><td>{row.email || "-"}</td><td>{roleLabel(row.role)}</td><td><span className={`status-label ${row.status === "active" ? "won" : "lost"}`}>{row.status || "active"}</span></td></tr>)}</tbody></table></div>;
}

function RelationshipTable({ rows }) {
  if (!rows.length) return <div className="state-message">No accessible farms found.</div>;
  const relationshipRows = rows.flatMap((row) => [
    { farm_id: row.farm_id, id: `owner-${row.farm_id}`, name: row.owner?.name || "Not assigned", farm_name: row.farm_name, phone: row.owner?.phone, email: row.owner?.email, role: "farmOwner", status: row.owner ? "active" : "inactive" },
    ...(row.managers || []).map((member) => ({ ...member, farm_id: row.farm_id, farm_name: row.farm_name })),
    ...(row.workers || []).map((member) => ({ ...member, farm_id: row.farm_id, farm_name: row.farm_name })),
  ]);
  return <DirectoryTable rows={relationshipRows} />;
}

export function DirectoryView({ view, directory, loading, error, onRefresh }) {
  const [search, setSearch] = useState("");
  const labels = { "farm-owners": "Farm Owners", "farm-managers": "Farm Managers", "farm-workers": "Farm Workers", relationships: "Relationships" };
  if (loading && !directory) return <section className="panel-card directory-panel"><div className="eyebrow">Customer directory</div><h2>Loading {labels[view]}</h2><p className="directory-help">Fetching all accessible farms and members.</p></section>;
  if (error && !directory) return <section className="panel-card directory-panel"><div className="eyebrow">Customer directory</div><h2>Directory unavailable</h2><p className="directory-help">{error}</p><button className="primary-button" type="button" onClick={onRefresh}>Try again</button></section>;
  if (!directory) return <section className="panel-card directory-panel"><h2>{labels[view]}</h2><div className="state-message">No directory data available.</div></section>;
  if (view === "relationships") {
    const relationshipRows = (directory.relationships || []).flatMap((row) => [
      { farm_id: row.farm_id, id: `owner-${row.farm_id}`, name: row.owner?.name || "Not assigned", farm_name: row.farm_name, phone: row.owner?.phone, email: row.owner?.email, role: "farmOwner", status: row.owner ? "active" : "inactive" },
      ...(row.managers || []).map((member) => ({ ...member, farm_id: row.farm_id, farm_name: row.farm_name })),
      ...(row.workers || []).map((member) => ({ ...member, farm_id: row.farm_id, farm_name: row.farm_name })),
    ]);
    const filteredRows = relationshipRows.filter((row) => [row.name, row.farm_name, row.phone, row.email, roleLabel(row.role), row.status].join(" ").toLowerCase().includes(search.toLowerCase()));
    return <section className="panel-card directory-panel"><div className="panel-heading"><div><div className="eyebrow">Farm relationships</div><h2>Farm ownership and team</h2></div><div className="directory-actions"><span>{filteredRows.length} members</span><button className="filter-button" type="button" onClick={onRefresh}>Refresh</button></div></div><label className="directory-search"><span>⌕</span><input aria-label="Search relationships" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search relationships" /></label><DirectoryTable rows={filteredRows} /></section>;
  }
  const rows = directory[view.replace("-", "_")] || [];
  const filteredRows = rows.filter((row) => [row.name, row.farm_name, row.phone, row.email, roleLabel(row.role), row.status].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <section className="panel-card directory-panel"><div className="panel-heading"><div><div className="eyebrow">Customer directory</div><h2>{labels[view]}</h2></div><div className="directory-actions"><span>{filteredRows.length} members</span>{view !== "farm-owners" && <button className="filter-button" type="button" onClick={onRefresh}>Refresh</button>}</div></div><label className="directory-search"><span>⌕</span><input aria-label={`Search ${labels[view]}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${labels[view].toLowerCase()}`} /></label><DirectoryTable rows={filteredRows} /></section>;
}
