const staffLinks = [
  { id: "staff-list", label: "Staff list" },
  { id: "staff-finance", label: "Finance" },
  { id: "staff-support", label: "Customer service" },
];

export function StaffSidebar({ activeView, setActiveView, groups, setGroups }) {
  return (
    <nav className="side-nav staff-side-nav" aria-label="Staff navigation">
      <button
        className="nav-group-toggle"
        type="button"
        onClick={() => setGroups((current) => ({ ...current, directory: !current.directory }))}
        aria-expanded={groups.directory}
      >
        <span>♙</span>
        <strong>My staff</strong>
        <b>{groups.directory ? "−" : "+"}</b>
      </button>
      {groups.directory && (
        <div className="nav-subgroup">
          {staffLinks.map((link) => (
            <button
              key={link.id}
              className={`nav-item ${activeView === link.id ? "active" : ""}`}
              type="button"
              onClick={() => setActiveView(link.id)}
            >
              <span>•</span> {link.label}
            </button>
          ))}
        </div>
      )}
      <button
        className={`nav-item standalone-nav-item ${activeView === "policy-new" ? "active" : ""}`}
        type="button"
        onClick={() => setActiveView("policy-new")}
      >
        <span>＋</span> New policy
      </button>
      <button
        className={`nav-item standalone-nav-item ${activeView === "policy-existing" ? "active" : ""}`}
        type="button"
        onClick={() => setActiveView("policy-existing")}
      >
        <span>▤</span> Existing policies
      </button>
      <button
        className={`nav-item standalone-nav-item ${activeView === "staff-logs" ? "active" : ""}`}
        type="button"
        onClick={() => setActiveView("staff-logs")}
      >
        <span>◷</span> Staff logs
      </button>
    </nav>
  );
}
