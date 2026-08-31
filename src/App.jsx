import { useEffect, useMemo, useState } from "react";
import { api, clearSession, ROLE_KEY, saveProfile, saveSession, TOKEN_KEY } from "./api";
const emptyCustomer = {
  farm_id: "",
  name: "",
  email: "",
  phone: "",
  company: "",
  address: "",
  type: "lead",
  status: "new",
  notes: "",
};
const statuses = ["all", "new", "contacted", "qualified", "won", "lost"];
const interactionTypes = ["message", "call", "email", "visit", "meeting", "note"];
const adminSections = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "customers", label: "Customers", icon: "◈" },
  { id: "staff", label: "Staff", icon: "♙" },
  { id: "finance", label: "Finance", icon: "⌁" },
  { id: "communication", label: "Communication", icon: "✦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function App() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const [form, setForm] = useState(emptyCustomer);
  const [interaction, setInteraction] = useState({ type: "message", notes: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [farmId, setFarmId] = useState("");
  const [staff, setStaff] = useState([]);
  const [auth, setAuth] = useState({
    email: "",
    password: "",
    token: localStorage.getItem(TOKEN_KEY) || "",
    role: localStorage.getItem(ROLE_KEY) || "",
  });
  const crmRole = auth.role || "customer_support";
  const isAdmin = crmRole === "admin";
  const canWriteCustomers = isAdmin || crmRole === "finance";
  const canReply = isAdmin || crmRole === "customer_support";
  const canNotify = isAdmin || crmRole === "customer_support";
  const [notification, setNotification] = useState({
    message: "",
    recipient_id: "",
  });
  const [activeSection, setActiveSection] = useState("home");
  const [activeView, setActiveView] = useState("customers");
  const [calculator, setCalculator] = useState({
    customers: "",
    amount: "",
  });
  const [report, setReport] = useState(null);
  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    description: "",
    amount: "",
    currency: "KES",
    pig_limit: "",
    active: true,
  });
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    password: "",
    crm_role: "finance",
  });
  const selectSection = (section) => {
    setActiveSection(section);
    if (section === "customers") setActiveView("customers");
    if (section === "finance") setActiveView("reports");
    if (section === "communication") setActiveView("communications");
  };
  const selected = useMemo(
    () => customers.find((customer) => customer.id === selectedId) || null,
    [customers, selectedId],
  );
  const counts = useMemo(
    () =>
      statuses
        .slice(1)
        .reduce(
          (result, status) => ({
            ...result,
            [status]: customers.filter((customer) => customer.status === status)
              .length,
          }),
          {},
        ),
    [customers],
  );
  const projectedRevenue = useMemo(() => {
    const customerCount = Number(calculator.customers) || 0;
    const monthlyAmount = Number(calculator.amount) || 0;
    return customerCount * monthlyAmount;
  }, [calculator]);
  const showNotice = (message, tone = "info") => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 3500);
  };
  const logout = async () => {
    try {
      if (auth.token) await api.post("/auth/logout");
    } catch {
      // The local session must still end when the server is unavailable.
    } finally {
      clearSession();
      setAuth((current) => ({ ...current, token: "", role: "" }));
      setFarmId("");
    }
  };
  useEffect(() => {
    if (!auth.token) return undefined;
    let timer;
    const resetIdleTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, 5 * 60 * 1000);
    };
    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer();
    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) return undefined;
    let active = true;
    api.get("/auth/me")
      .then((response) => {
        if (!active) return;
        const session = saveProfile(response);
        const role = session.user.crm_role || (session.user.role === "farmOwner" ? "admin" : "customer_support");
        const nextFarmId = session.farms[0]?.id ? String(session.farms[0].id) : "";
        setFarmId(nextFarmId);
        setForm((current) => ({ ...current, farm_id: nextFarmId }));
        setAuth((current) => ({ ...current, role }));
      })
      .catch(() => logout());
    return () => { active = false; };
  }, [auth.token]);

  useEffect(() => {
    const expire = () => setAuth((current) => ({ ...current, token: "", role: "" }));
    window.addEventListener("pigyworld-auth-expired", expire);
    return () => window.removeEventListener("pigyworld-auth-expired", expire);
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.status !== "all" ? { status: filters.status } : {}),
      };
      const response = await api.get("/crm/customers", { params });
      const data = response.data?.data || [];
      setCustomers(data);
      setSelectedId((current) =>
        data.some((customer) => customer.id === current)
          ? current
          : data[0]?.id || null,
      );
    } catch (error) {
      showNotice(
        error.response?.data?.message ||
          "Unable to load customers. Check your connection.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!auth.token) return undefined;
    const timer = window.setTimeout(() => loadCustomers(), 300);
    return () => window.clearTimeout(timer);
  }, [auth.token, filters.search, filters.status]);
  useEffect(() => {
    if (!auth.token || !isAdmin && crmRole !== "finance") return undefined;
    api
      .get("/crm/reports/overview", { params: farmId ? { farm_id: farmId } : {} })
      .then((response) => setReport(response.data?.data || null))
      .catch(() => showNotice("Unable to load finance overview.", "error"));
    return undefined;
  }, [auth.token, farmId, isAdmin, crmRole]);
  useEffect(() => {
    if (!auth.token || !isAdmin && crmRole !== "finance") return undefined;
    api.get("/subscription-plans")
      .then((response) => setPlans(response.data?.data || []))
      .catch(() => showNotice("Unable to load subscription plans.", "error"));
    return undefined;
  }, [auth.token, isAdmin, crmRole]);
  useEffect(() => {
    if (!selected) {
      setInteractions([]);
      return;
    }
    api
      .get(`/crm/customers/${selected.id}/interactions`)
      .then((response) => setInteractions(response.data?.data || []))
      .catch(() => showNotice("Unable to load interaction history.", "error"));
  }, [selectedId]);

  const login = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/auth/login", {
        identifier: auth.email,
        password: auth.password,
      });
      const session = saveSession(response);
      const token = response.data.access_token;
      const farms = session.farms;
      const selectedFarmId = farms[0]?.id ? String(farms[0].id) : "";
      const user = session.user;
      const role =
        user.crm_role ||
        (user.role === "farmOwner" ? "admin" : "customer_support");
      setFarmId(selectedFarmId);
      setForm((current) => ({ ...current, farm_id: selectedFarmId }));
      setAuth((current) => ({ ...current, token, role }));
      showNotice(`Welcome back. ${role.replace("_", " ")} workspace loaded.`);
    } catch (error) {
      showNotice(
        error.response?.data?.message ||
          "Authentication failed. Check your credentials.",
        "error",
      );
    }
  };
  const updateForm = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const saveCustomer = async (event) => {
    if (!canWriteCustomers)
      return showNotice(
        "Your CRM role cannot change customer records.",
        "error",
      );
    event.preventDefault();
    if (!form.name.trim())
      return showNotice("A customer name is required.", "error");
    if (!editing && !farmId)
      return showNotice("Your account is not linked to a farm.", "error");
    try {
      setSaving(true);
      const payload = {
        ...form,
        farm_id: Number(editing ? form.farm_id : farmId),
      };
      const response = editing
        ? await api.put(`/crm/customers/${selected.id}`, payload)
        : await api.post("/crm/customers", payload);
      const saved = response.data.data;
      setCustomers((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setSelectedId(saved.id);
      setForm({ ...emptyCustomer, farm_id: farmId });
      setEditing(false);
      showNotice(editing ? "Customer updated." : "Customer added.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not save this customer.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };
  const startEditing = () => {
    setForm({ ...emptyCustomer, ...selected });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteCustomer = async () => {
    if (!isAdmin)
      return showNotice("Only admins can delete customers.", "error");
    if (
      !selected ||
      !window.confirm(
        `Delete ${selected.name}? This also removes interaction history.`,
      )
    )
      return;
    try {
      await api.delete(`/crm/customers/${selected.id}`);
      setCustomers((current) =>
        current.filter((item) => item.id !== selected.id),
      );
      setSelectedId(null);
      showNotice("Customer deleted.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not delete this customer.",
        "error",
      );
    }
  };
  const addInteraction = async (event) => {
    event.preventDefault();
    if (!canReply)
      return showNotice(
        "Only customer support can reply to customers.",
        "error",
      );
    if (!selected) return;
    try {
      const response = await api.post(
        `/crm/customers/${selected.id}/interactions`,
        { ...interaction, occurred_at: new Date().toISOString() },
      );
      setInteractions((current) => [response.data.data, ...current]);
      setInteraction({ type: "message", notes: "" });
      showNotice("Reply logged.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not log reply.",
        "error",
      );
    }
  };
  const loadStaff = async () => {
    if (!canNotify || !farmId) return;
    try {
      const response = await api.get("/crm/members", {
        params: { farm_id: farmId },
      });
      setStaff(response.data?.data || []);
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Unable to load CRM accounts.",
        "error",
      );
    }
  };
  const updateStaff = async (member, data) => {
    try {
      const response = await api.patch(`/crm/members/${member.id}`, data);
      setStaff((current) =>
        current.map((item) =>
          item.id === member.id ? response.data.data : item,
        ),
      );
      showNotice("CRM account updated.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not update CRM account.",
        "error",
      );
    }
  };
  const deleteStaff = async (member) => {
    if (!window.confirm(`Delete ${member.name}'s CRM account?`)) return;
    try {
      await api.delete(`/crm/members/${member.id}`);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      showNotice("CRM account deleted.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not delete CRM account.",
        "error",
      );
    }
  };
  const addStaff = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/crm/members", {
        ...memberForm,
        farm_id: Number(farmId),
      });
      setStaff((current) => [...current, response.data.data]);
      setMemberForm({ name: "", email: "", password: "", crm_role: "finance" });
      showNotice("CRM account added.", "success");
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not add CRM account.", "error");
    }
  };
  const sendNotification = async (event) => {
    event.preventDefault();
    if (!canNotify || !notification.message.trim()) return;
    try {
      await api.post("/crm/notifications", {
        farm_id: Number(farmId),
        message: notification.message.trim(),
        ...(notification.recipient_id
          ? { recipient_id: Number(notification.recipient_id) }
          : {}),
      });
      setNotification({ message: "", recipient_id: "" });
      showNotice("Notification sent.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not send notification.",
        "error",
      );
    }
  };
  const savePlan = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/subscription-plans", {
        ...planForm,
        amount: Number(planForm.amount),
        pig_limit: planForm.pig_limit ? Number(planForm.pig_limit) : null,
      });
      setPlans((current) => [...current, response.data.data]);
      setPlanForm({ code: "", name: "", description: "", amount: "", currency: "USD", pig_limit: "", active: true });
      showNotice("Subscription plan created.", "success");
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not create subscription plan.", "error");
    }
  };
  const togglePlan = async (plan) => {
    try {
      const response = await api.patch(`/subscription-plans/${plan.id}`, { active: !plan.active });
      setPlans((current) => current.map((item) => item.id === plan.id ? response.data.data : item));
      showNotice(plan.active ? "Plan retired." : "Plan activated.", "success");
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not update subscription plan.", "error");
    }
  };
  useEffect(() => {
    if (auth.token && canNotify) loadStaff();
  }, [auth.token, farmId, canNotify]);

  if (!auth.token)
    return (
      <Login auth={auth} setAuth={setAuth} onSubmit={login} notice={notice} />
    );
  return (
    <div className={`app-shell ${activeSection === "home" ? "home-shell" : ""}`}>
      <aside className={`sidebar ${activeSection === "home" ? "sidebar-hidden" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <strong>Pig World</strong>
            <span>Customer desk</span>
          </div>
        </div>
        {activeSection === "customers" && <>
          <nav className="side-nav">
            <button className={`nav-item ${activeView === "customers" ? "active" : ""}`} onClick={() => setActiveView("customers")}><span>◈</span> Customer list</button>
            <button className="nav-item" onClick={() => showNotice("Customer segments are ready for the next CRM release.")}> <span>◇</span> Segments</button>
            <button className="nav-item" onClick={() => showNotice("Customer import is coming soon.")}><span>⇧</span> Import</button>
          </nav>
          <div className="side-caption">Pipeline</div>
          <div className="pipeline-list">
            {statuses.slice(1).map((status) => (
              <button key={status} onClick={() => setFilters((current) => ({ ...current, status }))}>
                <span className={`status-dot ${status}`} />{status[0].toUpperCase() + status.slice(1)}<b>{counts[status] || 0}</b>
              </button>
            ))}
          </div>
        </>}
        {activeSection === "staff" && <nav className="side-nav">
          <button className="nav-item active"><span>♙</span> Staff list</button>
          <button className="nav-item" onClick={() => showNotice("Policies are managed at farm level.")}> <span>▤</span> Policies</button>
          <button className="nav-item" onClick={() => showNotice("Staff activity logs will appear here.")}><span>◷</span> Staff logs</button>
        </nav>}
        <div className="sidebar-footer">
          <span className="avatar">PW</span>
          <div>
            <strong>Workspace</strong>
            <small>Farm operations</small>
          </div>
          <button
            className="icon-button"
            title="Sign out"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main-panel">
        <nav className="admin-navbar" aria-label="Admin navigation">
          <div className="admin-nav-label">Admin</div>
          <div className="admin-nav-links">
            {adminSections.map((section) => (
              <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => selectSection(section.id)}>
                <span>{section.icon}</span>{section.label}
              </button>
            ))}
          </div>
        </nav>
        <header className="topbar">
          <div>
            <div className="eyebrow">{isAdmin ? "Admin workspace" : `${crmRole.replace("_", " ")} workspace`}</div>
            <h1>
              {activeSection === "home"
                ? "Home"
                : activeSection === "staff"
                  ? "Staff"
                  : activeSection === "settings"
                    ? "Settings"
                    : activeView === "reports"
                ? "Finance overview"
                : activeView === "communications"
                  ? "Communications"
                  : "Customers"}
            </h1>
          </div>
          <div className="top-actions">
            {activeSection === "customers" && <button className="ghost-button" onClick={loadCustomers}>
              ↻ Refresh
            </button>}
            {activeSection === "customers" && canWriteCustomers && <button
              className="primary-button"
              onClick={() => {
                setEditing(false);
                setForm(emptyCustomer);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ＋ Add customer
            </button>}
          </div>
        </header>
        {notice && (
          <div className={`notice ${notice.tone}`}>{notice.message}</div>
        )}
        {activeSection === "home" && <HomeDashboard customers={customers} counts={counts} onOpen={selectSection} />}
        {canNotify && activeSection === "communication" && <section className="panel-card crm-tools">
          <div className="panel-heading"><div><div className="eyebrow">Broadcast</div><h2>Send notification</h2></div><span>All staff or one person</span></div>
          <form className="interaction-composer" onSubmit={sendNotification}>
            <select value={notification.recipient_id} onChange={(event) => setNotification((current) => ({ ...current, recipient_id: event.target.value }))}><option value="">Everyone in this farm</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.crm_role || member.role})</option>)}</select>
            <input required value={notification.message} onChange={(event) => setNotification((current) => ({ ...current, message: event.target.value }))} placeholder="Write a notification message" />
            <button className="primary-button" type="submit">Send</button>
          </form>
        </section>}
        {isAdmin && activeSection === "staff" && <section className="panel-card crm-tools">
          <div className="panel-heading"><div><div className="eyebrow">Administration</div><h2>CRM access</h2></div><span>Add, close, reassign, or delete accounts</span></div>
          <form className="staff-row" onSubmit={addStaff}><input required value={memberForm.name} onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" /><input required type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" /><input required type="password" minLength="8" value={memberForm.password} onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary password" /><select value={memberForm.crm_role} onChange={(event) => setMemberForm((current) => ({ ...current, crm_role: event.target.value }))}><option value="finance">Finance</option><option value="customer_support">Customer support</option></select><button className="primary-button" type="submit">Add account</button></form>
          {staff.filter((member) => member.crm_role !== "admin").map((member) => <div className="staff-row" key={member.id}><strong>{member.name}</strong><span>{member.email}</span><select value={member.crm_role || ""} onChange={(event) => updateStaff(member, { crm_role: event.target.value })}><option value="finance">Finance</option><option value="customer_support">Customer support</option></select><button className="filter-button" onClick={() => updateStaff(member, { closed: !member.crm_closed_at })}>{member.crm_closed_at ? "Unsuspend" : "Suspend"}</button><button className="danger-button" onClick={() => deleteStaff(member)}>Delete</button></div>)}
        </section>}
        {activeSection === "settings" && <section className="panel-card section-placeholder">
          <div className="eyebrow">Workspace preferences</div>
          <h2>Settings</h2>
          <p>Manage workspace preferences, notifications, and account defaults from this area.</p>
          <button className="ghost-button" onClick={() => showNotice("Settings controls are being connected to the workspace API.")}>Workspace settings</button>
        </section>}
        {activeSection === "finance" && (
          <FinanceDashboard
            customers={customers}
            counts={counts}
            report={report}
            calculator={calculator}
            setCalculator={setCalculator}
            projectedRevenue={projectedRevenue}
            plans={plans}
            planForm={planForm}
            setPlanForm={setPlanForm}
            savePlan={savePlan}
            togglePlan={togglePlan}
            canManagePlans={isAdmin || crmRole === "finance"}
          />
        )}
        {activeSection === "customers" && <section className="stats-row">
          <div>
            <span>Total relationships</span>
            <strong>{customers.length}</strong>
          </div>
          <div>
            <span>Qualified leads</span>
            <strong>{counts.qualified || 0}</strong>
          </div>
          <div>
            <span>Won this cycle</span>
            <strong>{counts.won || 0}</strong>
          </div>
          <div className="accent-stat">
            <span>Conversion focus</span>
            <strong>
              {customers.length
                ? `${Math.round(((counts.won || 0) / customers.length) * 100)}%`
                : "0%"}
            </strong>
          </div>
        </section>}
        {activeSection === "customers" && <section className="workspace-grid">
          <div className="list-panel panel-card">
            <div className="panel-heading">
              <div>
                <h2>Customer list</h2>
                <span>{customers.length} records in view</span>
              </div>
              <button
                className="filter-button"
                onClick={() => setFilters({ search: "", status: "all" })}
              >
                Clear filters
              </button>
            </div>
            <div className="search-field">
              <span>⌕</span>
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search name, company, or email"
              />
            </div>
            <div className="filter-tabs">
              {statuses.map((status) => (
                <button
                  key={status}
                  className={filters.status === status ? "selected" : ""}
                  onClick={() =>
                    setFilters((current) => ({ ...current, status }))
                  }
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
            </div>
            <div className="customer-list">
              {loading ? (
                <div className="state-message">Loading customers…</div>
              ) : customers.length === 0 ? (
                <div className="state-message">
                  No customers match these filters.
                </div>
              ) : (
                customers.map((customer) => (
                  <button
                    key={customer.id}
                    className={`customer-row ${selectedId === customer.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(customer.id)}
                  >
                    <span className="customer-avatar">
                      {customer.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="customer-row-copy">
                      <strong>{customer.name}</strong>
                      <small>
                        {customer.company ||
                          customer.email ||
                          "No company details"}
                      </small>
                    </span>
                    <span className={`status-label ${customer.status}`}>
                      {customer.status}
                    </span>
                    <span className="row-arrow">›</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="detail-column">
            {editing ? (
              <CustomerForm
                form={form}
                updateForm={updateForm}
                onSubmit={saveCustomer}
                onCancel={() => setEditing(false)}
                saving={saving}
              />
            ) : selected ? (
              <>
                <section className="detail-card panel-card">
                  <div className="detail-header">
                    <div className="profile-heading">
                      <span className="profile-avatar">
                        {selected.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <div className="eyebrow">
                          {selected.type} relationship
                        </div>
                        <h2>{selected.name}</h2>
                        <span>{selected.company || "Independent contact"}</span>
                      </div>
                    </div>
                    <div className="detail-actions">
                      {canWriteCustomers && <button className="ghost-button" onClick={startEditing}>Edit</button>}
                      {isAdmin && <button className="danger-button" onClick={deleteCustomer}>Delete</button>}
                    </div>
                  </div>
                  <div className="contact-grid">
                    <ContactItem label="Email" value={selected.email} />
                    <ContactItem label="Phone" value={selected.phone} />
                    <ContactItem label="Address" value={selected.address} />
                    <ContactItem
                      label="Status"
                      value={selected.status}
                      accent
                    />
                  </div>
                  {selected.notes && (
                    <div className="notes">
                      <span>Notes</span>
                      <p>{selected.notes}</p>
                    </div>
                  )}
                </section>
                <section className="activity-card panel-card">
                  <div className="panel-heading">
                    <div>
                      <h2>Activity timeline</h2>
                      <span>Keep every conversation in context</span>
                    </div>
                    <span className="activity-count">
                      {interactions.length} events
                    </span>
                  </div>
                  {canReply && <form
                    className="interaction-composer"
                    onSubmit={addInteraction}
                  >
                    <select
                      value={interaction.type}
                      onChange={(event) =>
                        setInteraction((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                    >
                      {interactionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type[0].toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={interaction.notes}
                      onChange={(event) =>
                        setInteraction((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder={canReply ? "Write a reply to this customer…" : "Customer activity is read-only"}
                      disabled={!canReply}
                    />
                    <button className="primary-button" type="submit">
                      {canReply ? "Send reply" : "Read only"}
                    </button>
                  </form>}
                  <div className="timeline">
                    {interactions.length === 0 ? (
                      <div className="state-message">
                        No activity recorded yet.
                      </div>
                    ) : (
                      interactions.map((item) => (
                        <div className="timeline-item" key={item.id}>
                          <span className="timeline-icon">
                            {item.type === "call"
                              ? "⌕"
                              : item.type === "email"
                                ? "@"
                                : "✦"}
                          </span>
                          <div>
                            <strong>
                              {item.type[0].toUpperCase() + item.type.slice(1)}
                            </strong>
                            <span>{item.notes || "No notes added"}</span>
                          </div>
                          <time>
                            {new Date(item.occurred_at).toLocaleDateString()}
                          </time>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="empty-detail panel-card">
                <span>◈</span>
                <h2>Choose a relationship</h2>
                <p>
                  Select a customer from the list to see their details and
                  activity.
                </p>
              </div>
            )}
          </div>
        </section>}
      </main>
    </div>
  );
}

function HomeDashboard({ customers, counts, onOpen }) {
  return (
    <section className="home-dashboard">
      <div className="home-intro">
        <div>
          <div className="eyebrow">Workspace at a glance</div>
          <h2>Good to see you.</h2>
          <p>Choose an area from the Admin navigation to keep farm operations moving.</p>
        </div>
        <button className="primary-button" onClick={() => onOpen("customers")}>Open customer list</button>
      </div>
      <div className="home-metrics">
        <button onClick={() => onOpen("customers")}><span>Customers</span><strong>{customers.length}</strong><small>View relationships</small></button>
        <button onClick={() => onOpen("staff")}><span>Staff workspace</span><strong>→</strong><small>Manage accounts and access</small></button>
        <button onClick={() => onOpen("finance")}><span>Finance</span><strong>{counts.won || 0}</strong><small>Won relationships this cycle</small></button>
      </div>
    </section>
  );
}

function FinanceDashboard({
  customers,
  counts,
  report,
  calculator,
  setCalculator,
  projectedRevenue,
  plans,
  planForm,
  setPlanForm,
  savePlan,
  togglePlan,
  canManagePlans,
}) {
  const activeRelationships = report?.active_relationships ?? customers.filter(
    (customer) => !["lost"].includes(customer.status),
  ).length;
  const winRate = report?.conversion_rate ?? (customers.length
    ? Math.round(((counts.won || 0) / customers.length) * 100)
    : 0);
  const statusTotal = report?.total_customers ?? customers.length;
  const statusCounts = report?.by_status || counts;

  return (
    <section className="finance-dashboard">
      <div className="finance-kpis">
        <div className="finance-kpi">
          <span>Active relationships</span>
          <strong>{activeRelationships}</strong>
          <small>Current CRM records excluding lost</small>
        </div>
        <div className="finance-kpi">
          <span>Qualified pipeline</span>
          <strong>{report?.qualified ?? counts.qualified ?? 0}</strong>
          <small>Ready for subscription follow-up</small>
        </div>
        <div className="finance-kpi finance-kpi-accent">
          <span>Conversion rate</span>
          <strong>{winRate}%</strong>
          <small>Won relationships this cycle</small>
        </div>
      </div>
      <div className="finance-columns">
        <section className="panel-card finance-breakdown">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Customer health</div>
              <h2>Pipeline by status</h2>
            </div>
            <span>{statusTotal} records</span>
          </div>
          {statuses.slice(1).map((status) => (
            <div className="breakdown-row" key={status}>
              <span className={`status-dot ${status}`} />
              <span>{status[0].toUpperCase() + status.slice(1)}</span>
              <div className="breakdown-bar"><i style={{ width: `${statusTotal ? ((statusCounts[status] || 0) / statusTotal) * 100 : 0}%` }} /></div>
              <strong>{statusCounts[status] || 0}</strong>
            </div>
          ))}
        </section>
        <section className="panel-card calculator-card">
          <div className="eyebrow">Planning tool</div>
          <h2>Revenue calculator</h2>
          <p>Estimate monthly revenue from the active subscription catalog.</p>
          <label>Paying customers<input type="number" min="0" value={calculator.customers} onChange={(event) => setCalculator((current) => ({ ...current, customers: event.target.value }))} placeholder="0" /></label>
          <label>Monthly amount<input type="number" min="0" step="0.01" value={calculator.amount} onChange={(event) => setCalculator((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></label>
          <div className="calculator-total"><span>Projected monthly revenue</span><strong>{projectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        </section>
      </div>
      <section className="panel-card finance-next-step">
        <div><div className="eyebrow">Payment setup</div><h2>Plans are ready for checkout</h2><p>Choose a payment provider before enabling gateway transactions for these prices.</p></div>
        <button className="ghost-button" onClick={() => window.alert("Add the payment provider and server-side credentials to enable checkout.")}>View integration status</button>
      </section>
      <section className="panel-card subscription-farms-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">Farm subscriptions</div><h2>Herd-based billing</h2></div>
          <span>{report?.subscriptions?.length || 0} farms</span>
        </div>
        {(report?.subscriptions || []).length === 0 ? <p>No farm subscription payments recorded yet.</p> : <div className="plan-list">
          {report.subscriptions.map((farm) => <div className="staff-row" key={farm.id}>
            <strong>{farm.name}</strong>
            <span>{farm.mother_pig_count ?? 0} mother pigs</span>
            <span>{farm.subscription_plan || "No plan"}</span>
            <span>{farm.payment_amount ? `${farm.payment_amount} ${farm.payment_currency}` : "No payment"}</span>
            <span>{farm.payment_status || "pending"}</span>
            <span>{farm.mpesa_receipt || "Awaiting M-Pesa"}</span>
          </div>)}
        </div>}
      </section>
      {canManagePlans && <section className="panel-card subscription-plans-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">Billing catalog</div><h2>Subscription plans</h2></div>
          <span>{plans.length} plans</span>
        </div>
        <form className="staff-row" onSubmit={savePlan}>
          <input required value={planForm.code} onChange={(event) => setPlanForm((current) => ({ ...current, code: event.target.value }))} placeholder="Code" />
          <input required value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} placeholder="Plan name" />
          <input required type="number" min="0" step="0.01" value={planForm.amount} onChange={(event) => setPlanForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" />
          <input required maxLength="3" value={planForm.currency} onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="Currency" />
          <input type="number" min="1" value={planForm.pig_limit} onChange={(event) => setPlanForm((current) => ({ ...current, pig_limit: event.target.value }))} placeholder="Pig limit" />
          <button className="primary-button" type="submit">Add plan</button>
        </form>
        <div className="plan-list">
          {plans.map((plan) => <div className="staff-row" key={plan.id}>
            <strong>{plan.name}</strong>
            <span>{plan.amount} {plan.currency}</span>
            <span>{plan.pig_limit ? `Up to ${plan.pig_limit} pigs` : "Unlimited pigs"}</span>
            <span>{plan.active ? "Active" : "Retired"}</span>
            <button className="filter-button" type="button" onClick={() => togglePlan(plan)}>{plan.active ? "Retire" : "Activate"}</button>
          </div>)}
        </div>
      </section>}
    </section>
  );
}

function Login({ auth, setAuth, onSubmit, notice }) {
  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="art-label">PIG WORLD / CRM</div>
        <div className="art-copy">
          <h1>
            Better conversations.
            <br />
            <em>Stronger herds.</em>
          </h1>
          <p>Keep buyers, partners, and opportunities moving with the farm.</p>
        </div>
        <div className="art-footer">
          Customer relationships, thoughtfully managed.
        </div>
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <strong>Pig World</strong>
            <span>Customer desk</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to your workspace</h2>
          <p className="muted-copy">Use your Pig World account to continue.</p>
        </div>
        {notice && (
          <div className={`notice ${notice.tone}`}>{notice.message}</div>
        )}
        <label>
          Email address
          <input
            type="email"
            required
            value={auth.email}
            onChange={(event) =>
              setAuth((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={auth.password}
            onChange={(event) =>
              setAuth((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Your password"
          />
        </label>
        <button className="primary-button" type="submit">
          Continue <span>→</span>
        </button>
        <small className="login-help">
          Protected by your Pig World account
        </small>
      </form>
    </div>
  );
}
function CustomerForm({ form, updateForm, onSubmit, onCancel, saving }) {
  return (
    <section className="form-card panel-card">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            {form.id ? "Update record" : "New relationship"}
          </div>
          <h2>{form.id ? "Edit customer" : "Add a customer"}</h2>
        </div>
        <button className="icon-button" onClick={onCancel} title="Close">
          ×
        </button>
      </div>
      <form className="customer-form" onSubmit={onSubmit}>
        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="e.g. Amara Foods"
          />
        </label>
        <div className="form-two">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              placeholder="contact@company.com"
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              placeholder="+254 700 000 000"
            />
          </label>
        </div>
        <div className="form-two">
          <label>
            Company
            <input
              value={form.company}
              onChange={(event) => updateForm("company", event.target.value)}
              placeholder="Business or organization"
            />
          </label>
          <label>
            Relationship
            <select
              value={form.type}
              onChange={(event) => updateForm("type", event.target.value)}
            >
              <option value="lead">Lead</option>
              <option value="buyer">Buyer</option>
              <option value="supplier">Supplier</option>
            </select>
          </label>
        </div>
        <div className="form-two">
          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              {statuses.slice(1).map((status) => (
                <option key={status} value={status}>
                  {status[0].toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Farm ID
            <input
              value={form.farm_id}
              onChange={(event) => updateForm("farm_id", event.target.value)}
            />
          </label>
        </div>
        <label>
          Address
          <input
            value={form.address}
            onChange={(event) => updateForm("address", event.target.value)}
            placeholder="Location or postal address"
          />
        </label>
        <label>
          Notes
          <textarea
            rows="4"
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            placeholder="Context, preferences, or next steps"
          />
        </label>
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Create customer"}
          </button>
        </div>
      </form>
    </section>
  );
}
function ContactItem({ label, value, accent }) {
  return (
    <div className="contact-item">
      <span>{label}</span>
      <strong className={accent ? `status-label ${value}` : ""}>
        {value || "Not provided"}
      </strong>
    </div>
  );
}
export default App;
