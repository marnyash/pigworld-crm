export function HomeDashboard({ dashboard, loading, error, onRefresh, onOpen, onOpenStatus }) {
  if (loading && !dashboard) {
    return <section className="home-dashboard-state panel-card"><div className="eyebrow">Workspace at a glance</div><h2>Loading dashboard</h2><p>Fetching current farm metrics and work queues.</p></section>;
  }
  if (error && !dashboard) {
    return <section className="home-dashboard-state panel-card"><div className="eyebrow">Dashboard unavailable</div><h2>We could not load Home</h2><p>{error}</p><button className="primary-button" type="button" onClick={onRefresh}>Try again</button></section>;
  }
  if (!dashboard) {
    return <section className="home-dashboard-state panel-card"><div className="eyebrow">No farm selected</div><h2>Choose a farm to continue</h2><p>Home metrics will appear when your account is linked to a farm.</p></section>;
  }
  const customers = dashboard.customers || {};
  const tasks = dashboard.tasks || {};
  const statuses = customers.by_status || {};
  const taskItems = tasks.items || [];
  const activity = dashboard.activity || [];
  const messages = dashboard.messages || [];
  const staff = dashboard.staff || [];
  return (
    <section className="home-dashboard">
      <div className="home-intro">
        <div>
          <div className="eyebrow">Workspace at a glance</div>
          <h2>Good to see you.</h2>
          <p>Current CRM performance and follow-up work for this farm.</p>
        </div>
        <button className="primary-button" type="button" onClick={onRefresh}>Refresh dashboard</button>
      </div>
      <div className="home-kpis">
        <HomeKpi label="Customers" value={customers.total} onClick={() => onOpen("customers")} />
        <HomeKpi label="Active relationships" value={customers.active} onClick={() => onOpenStatus("all")} />
        <HomeKpi label="Qualified leads" value={customers.qualified} onClick={() => onOpenStatus("qualified")} />
        <HomeKpi label="Won relationships" value={customers.won} onClick={() => onOpenStatus("won")} />
        <HomeKpi label="Conversion rate" value={`${customers.conversion_rate || 0}%`} onClick={() => onOpen("finance")} />
        <HomeKpi label="Payment status" value={dashboard.finance?.payment_status || "Not available"} onClick={() => onOpen("finance")} />
      </div>
      <div className="home-content-grid">
        <section className="panel-card home-panel">
          <div className="panel-heading"><div><div className="eyebrow">Pipeline</div><h2>Customer status</h2></div><button className="filter-button" type="button" onClick={() => onOpen("customers")}>Open list</button></div>
          <div className="home-pipeline">{["new", "contacted", "qualified", "won", "lost"].map((status) => <button type="button" key={status} onClick={() => onOpenStatus(status)}><span className={`status-dot ${status}`} /><strong>{statuses[status] || 0}</strong><small>{status}</small></button>)}</div>
        </section>
        <section className="panel-card home-panel">
          <div className="panel-heading"><div><div className="eyebrow">Follow-up queue</div><h2>Today’s work</h2></div><span>{(tasks.overdue || 0) + (tasks.due_today || 0)} due</span></div>
          <div className="home-task-summary"><strong>{tasks.overdue || 0}</strong><span>Overdue</span><strong>{tasks.due_today || 0}</strong><span>Due today</span><strong>{tasks.unassigned || 0}</strong><span>Unassigned</span></div>
          {taskItems.length === 0 ? <div className="state-message">No open follow-up tasks.</div> : <div className="home-task-list">{taskItems.slice(0, 5).map((task) => <button type="button" key={task.id} onClick={() => onOpen("customers")}><span className={`task-priority ${task.priority}`} /><span><strong>{task.title}</strong><small>{task.customer_name || "Customer"} · {task.assignee_name || "Unassigned"}</small></span></button>)}</div>}
        </section>
        <section className="panel-card home-panel">
          <div className="panel-heading"><div><div className="eyebrow">Customer activity</div><h2>Recent activity</h2></div><button className="filter-button" type="button" onClick={() => onOpen("customers")}>View customers</button></div>
          {activity.length === 0 ? <div className="state-message">No customer activity recorded.</div> : <div className="home-activity-list">{activity.slice(0, 5).map((item) => <div className="home-activity" key={item.id}><span className="timeline-icon">{item.subtype || item.type}</span><div><strong>{item.customer_name || "Customer"}</strong><small>{item.notes || item.subtype || item.type} · {item.actor_name || "System"}</small></div><time>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : ""}</time></div>)}</div>}
        </section>
        <section className="panel-card home-panel">
          <div className="panel-heading"><div><div className="eyebrow">Team workload</div><h2>Open tasks by staff</h2></div><button className="filter-button" type="button" onClick={() => onOpen("staff")}>Staff</button></div>
          {staff.length === 0 ? <div className="state-message">No CRM staff workload data.</div> : <div className="home-staff-list">{staff.map((member) => <div key={member.id}><span>{member.name}</span><strong>{member.open_tasks}</strong></div>)}</div>}
        </section>
      </div>
      <div className="home-footer-grid">
        <section className="panel-card home-panel"><div className="panel-heading"><div><div className="eyebrow">Communication</div><h2>Recent messages</h2></div><button className="filter-button" type="button" onClick={() => onOpen("communication")}>Open inbox</button></div>{messages.length === 0 ? <div className="state-message">No CRM messages.</div> : messages.slice(0, 3).map((message) => <div className="home-message" key={message.id}><strong>{message.sender_name || "Farm team"}</strong><p>{message.message}</p></div>)}</section>
        <section className="panel-card home-panel home-actions"><div className="eyebrow">Quick actions</div><h2>Keep work moving</h2><div><button className="primary-button" type="button" onClick={() => onOpen("customers")}>Open customers</button><button className="ghost-button" type="button" onClick={() => onOpen("finance")}>View finance</button><button className="ghost-button" type="button" onClick={() => onOpen("communication")}>Send notification</button></div></section>
      </div>
    </section>
  );
}

function HomeKpi({ label, value, onClick }) {
  return <button className="home-kpi" type="button" onClick={onClick}><span>{label}</span><strong>{value ?? 0}</strong><small>Open related workspace</small></button>;
}
