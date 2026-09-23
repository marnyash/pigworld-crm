import { useEffect, useState } from "react";

export function HomeDashboard({ dashboard, loading, error, onRefresh, onOpen, onOpenStatus }) {
  const [metric, setMetric] = useState("growth");
  const [chartType, setChartType] = useState("pie");
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setHeroSlide((current) => (current + 1) % 2), 5000);
    return () => window.clearInterval(timer);
  }, []);
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
  const alerts = dashboard.alerts || {};
  const statuses = customers.by_status || {};
  const growth = customers.growth || [];
  const activeChart = metric === "growth"
    ? { eyebrow: "Customer growth", title: "New customers over the last six months", action: "Open customers", onAction: () => onOpen("customers"), items: growth }
    : { eyebrow: "Revenue collected", title: "Paid revenue from this farm", action: "Open finance", onAction: () => onOpen("finance"), items: [{ label: "Collected", value: dashboard.finance?.revenue_collected || 0 }] };
  const maxValue = Math.max(...activeChart.items.map((item) => item.value), 1);
  const pieTotal = activeChart.items.reduce((total, item) => total + item.value, 0);
  let pieOffset = 0;
  const pieGradient = activeChart.items.map((item, index) => {
    const start = pieOffset;
    pieOffset += pieTotal ? (item.value / pieTotal) * 360 : 0;
    return `${["#286846", "#5b9c98", "#7197d1", "#cf8a43", "#bf5f63", "#8a6ca8"][index % 6]} ${start}deg ${pieOffset}deg`;
  }).join(", ");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const refreshedAt = dashboard.generated_at ? new Date(dashboard.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not available";
  const alertItems = [
    { label: "Overdue tasks", value: dashboard.tasks?.overdue || 0, action: () => onOpen("tasks"), tone: "urgent" },
    { label: "New messages", value: alerts.new_messages || 0, action: () => onOpen("communication"), tone: "message" },
    { label: "Pending payments", value: alerts.pending_payments || 0, action: () => onOpen("finance"), tone: "payment" },
    { label: "New orders", value: alerts.new_orders || 0, action: () => onOpen("customers"), tone: "order" },
  ];
  return (
    <section className="home-dashboard">
      <div className="home-intro">
        <div className="home-intro-content">
          {heroSlide === 0 ? <div className="home-hero-slide" key="greeting"><div className="eyebrow">Workspace at a glance</div><h2>{greeting}</h2><p>Current CRM performance and follow-up work for this farm.</p></div> : <div className="home-hero-slide" key="status"><div className="eyebrow">Today at a glance</div><h2>{new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</h2><p>Last data refresh: {refreshedAt}</p><div className="home-alerts">{alertItems.map((alert) => <button className={`home-alert ${alert.tone}`} type="button" key={alert.label} onClick={alert.action}><strong>{alert.value}</strong><span>{alert.label}</span></button>)}</div></div>}
          <div className="home-hero-dots" aria-label="Home summary slides"><button type="button" className={heroSlide === 0 ? "active" : ""} aria-label="Show greeting" onClick={() => setHeroSlide(0)} /><button type="button" className={heroSlide === 1 ? "active" : ""} aria-label="Show daily summary" onClick={() => setHeroSlide(1)} /></div>
        </div>
        <button className="primary-button" type="button" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing..." : "Refresh dashboard"}</button>
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
        <div className="home-chart-toolbar">
          <div className="home-chart-tabs" role="tablist" aria-label="Home chart metrics">
            <button type="button" className={metric === "growth" ? "selected" : ""} onClick={() => setMetric("growth")}>Customer growth</button>
            <button type="button" className={metric === "revenue" ? "selected" : ""} onClick={() => setMetric("revenue")}>Revenue collected</button>
          </div>
          <div className="chart-type-picker">
            <button className="chart-fab" type="button" aria-label="Change chart type" onClick={() => setShowChartMenu((visible) => !visible)}>⌁</button>
            {showChartMenu && <div className="chart-type-menu">{["pie", "line", "bar", "histogram"].map((type) => <button key={type} type="button" className={chartType === type ? "selected" : ""} onClick={() => { setChartType(type); setShowChartMenu(false); }}>{type}</button>)}</div>}
          </div>
        </div>
        {activeChart.items.length === 0 ? <div className="state-message home-chart-empty">No data available for this view yet.</div> : <div className={`home-chart ${chartType}`} role="img" aria-label={activeChart.title}>
          {chartType === "pie" && <div className="home-pie-visual"><span className="home-pie" style={{ background: pieTotal ? `conic-gradient(${pieGradient})` : "#dfe8df" }} /><div className="home-pie-legend">{activeChart.items.map((item, index) => <div key={`${item.label}-legend`}><i style={{ background: ["#286846", "#5b9c98", "#7197d1", "#cf8a43", "#bf5f63", "#8a6ca8"][index % 6] }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>}
          {chartType !== "pie" && activeChart.items.map((item) => <button type="button" className="home-chart-row" key={`${item.label}-${item.value}`} onClick={activeChart.onAction}>
            <span className="home-chart-label"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>
            <span className="home-chart-track"><i className="home-chart-bar" style={{ width: `${Math.max((item.value / maxValue) * 100, 4)}%` }} /></span>
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
