import { useState } from "react";

export function HomeDashboard({ dashboard, loading, error, onRefresh, onOpen, onOpenStatus }) {
  const [chart, setChart] = useState("pipeline");
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
  const activity = dashboard.activity || [];
  const messages = dashboard.messages || [];
  const staff = dashboard.staff || [];
  const charts = {
    pipeline: {
      eyebrow: "Customer pipeline",
      title: "Relationship momentum",
      action: "Open customers",
      onAction: () => onOpen("customers"),
      items: ["new", "contacted", "qualified", "won", "lost"].map((label) => ({ label, value: statuses[label] || 0, tone: label })),
    },
    tasks: {
      eyebrow: "Follow-up queue",
      title: "Work requiring attention",
      action: "Open customers",
      onAction: () => onOpen("customers"),
      items: [
        { label: "Overdue", value: tasks.overdue || 0, tone: "urgent" },
        { label: "Due today", value: tasks.due_today || 0, tone: "today" },
        { label: "Unassigned", value: tasks.unassigned || 0, tone: "unassigned" },
      ],
    },
    staff: {
      eyebrow: "Team workload",
      title: "Open tasks by staff",
      action: "Open staff",
      onAction: () => onOpen("staff"),
      items: staff.slice(0, 6).map((member) => ({ label: member.name, value: member.open_tasks || 0, tone: "staff" })),
    },
    activity: {
      eyebrow: "Customer activity",
      title: "Recent customer touchpoints",
      action: "Open customers",
      onAction: () => onOpen("customers"),
      items: activity.slice(0, 6).map((item) => ({ label: item.customer_name || "Customer", value: 1, detail: item.subtype || item.type || "Activity", tone: "activity" })),
    },
    messages: {
      eyebrow: "Communication",
      title: "Recent CRM messages",
      action: "Open inbox",
      onAction: () => onOpen("communication"),
      items: messages.slice(0, 6).map((message) => ({ label: message.sender_name || "Farm team", value: 1, detail: message.message, tone: "message" })),
    },
  };
  const activeChart = charts[chart];
  const maxValue = Math.max(...activeChart.items.map((item) => item.value), 1);
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
      <section className="panel-card home-chart-panel">
        <div className="home-chart-header">
          <div><div className="eyebrow">{activeChart.eyebrow}</div><h2>{activeChart.title}</h2></div>
          <div className="home-chart-actions"><button className="filter-button" type="button" onClick={activeChart.onAction}>{activeChart.action}</button></div>
        </div>
        <div className="home-chart-tabs" role="tablist" aria-label="Home chart views">
          {Object.entries(charts).map(([id, value]) => <button key={id} type="button" className={chart === id ? "selected" : ""} onClick={() => setChart(id)}>{value.eyebrow}</button>)}
        </div>
        {activeChart.items.length === 0 ? <div className="state-message home-chart-empty">No data available for this view yet.</div> : <div className="home-chart" role="img" aria-label={activeChart.title}>
          {activeChart.items.map((item) => <button type="button" className="home-chart-row" key={`${item.label}-${item.detail || ""}`} onClick={chart === "pipeline" ? () => onOpenStatus(item.label) : activeChart.onAction}>
            <span className="home-chart-label"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>
            <span className="home-chart-track"><i className={`home-chart-bar ${item.tone}`} style={{ width: `${Math.max((item.value / maxValue) * 100, 4)}%` }} /></span>
            <strong className="home-chart-value">{item.value}</strong>
          </button>)}
        </div>}
      </section>
    </section>
  );
}

function HomeKpi({ label, value, onClick }) {
  return <button className="home-kpi" type="button" onClick={onClick}><span>{label}</span><strong>{value ?? 0}</strong><small>Open related workspace</small></button>;
}
