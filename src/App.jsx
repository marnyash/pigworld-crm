import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const TOKEN_KEY = "pigyworld_access_token";
const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
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
    role: localStorage.getItem("pigyworld_crm_role") || "",
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
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    password: "",
    crm_role: "finance",
  });
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
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("pigyworld_crm_role");
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
    if (auth.token) loadCustomers();
  }, [auth.token, filters.status]);
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
        email: auth.email,
        password: auth.password,
      });
      const token = response.data.access_token;
      const farms = response.data.farms?.data || response.data.farms || [];
      const selectedFarmId = farms[0]?.id ? String(farms[0].id) : "";
      const user = response.data.user || {};
      const role =
        user.crm_role ||
        (user.role === "farmOwner" ? "admin" : "customer_support");
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("pigyworld_crm_role", role);
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
  useEffect(() => {
    if (auth.token && canNotify) loadStaff();
  }, [auth.token, farmId, canNotify]);

  if (!auth.token)
    return (
      <Login auth={auth} setAuth={setAuth} onSubmit={login} notice={notice} />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <strong>Pigyworld</strong>
            <span>Customer desk</span>
          </div>
        </div>
        <nav className="side-nav">
          <button className="nav-item active">
            <span>◈</span> Customers
          </button>
          <button
            className="nav-item"
            onClick={() => showNotice("Reports are coming soon.")}
          >
            <span>⌁</span> Reports
          </button>
        </nav>
        <div className="side-caption">Pipeline</div>
        <div className="pipeline-list">
          {statuses.slice(1).map((status) => (
            <button
              key={status}
              onClick={() => setFilters((current) => ({ ...current, status }))}
            >
              <span className={`status-dot ${status}`} />
              {status[0].toUpperCase() + status.slice(1)}
              <b>{counts[status] || 0}</b>
            </button>
          ))}
        </div>
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
        <header className="topbar">
          <div>
            <div className="eyebrow">{isAdmin ? "Admin workspace" : `${crmRole.replace("_", " ")} workspace`}</div>
            <h1>Customers</h1>
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={loadCustomers}>
              ↻ Refresh
            </button>
            {canWriteCustomers && <button
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
        {canNotify && <section className="panel-card crm-tools">
          <div className="panel-heading"><div><div className="eyebrow">Broadcast</div><h2>Send notification</h2></div><span>All staff or one person</span></div>
          <form className="interaction-composer" onSubmit={sendNotification}>
            <select value={notification.recipient_id} onChange={(event) => setNotification((current) => ({ ...current, recipient_id: event.target.value }))}><option value="">Everyone in this farm</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.crm_role || member.role})</option>)}</select>
            <input required value={notification.message} onChange={(event) => setNotification((current) => ({ ...current, message: event.target.value }))} placeholder="Write a notification message" />
            <button className="primary-button" type="submit">Send</button>
          </form>
        </section>}
        {isAdmin && <section className="panel-card crm-tools">
          <div className="panel-heading"><div><div className="eyebrow">Administration</div><h2>CRM access</h2></div><span>Add, close, reassign, or delete accounts</span></div>
          <form className="staff-row" onSubmit={addStaff}><input required value={memberForm.name} onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" /><input required type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" /><input required type="password" minLength="8" value={memberForm.password} onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary password" /><select value={memberForm.crm_role} onChange={(event) => setMemberForm((current) => ({ ...current, crm_role: event.target.value }))}><option value="finance">Finance</option><option value="customer_support">Customer support</option></select><button className="primary-button" type="submit">Add account</button></form>
          {staff.filter((member) => member.crm_role !== "admin").map((member) => <div className="staff-row" key={member.id}><strong>{member.name}</strong><span>{member.email}</span><select value={member.crm_role || ""} onChange={(event) => updateStaff(member, { crm_role: event.target.value })}><option value="finance">Finance</option><option value="customer_support">Customer support</option></select><button className="filter-button" onClick={() => updateStaff(member, { closed: !member.crm_closed_at })}>{member.crm_closed_at ? "Reopen" : "Close"}</button><button className="danger-button" onClick={() => deleteStaff(member)}>Delete</button></div>)}
        </section>}
        <section className="stats-row">
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
        </section>
        <section className="workspace-grid">
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
                onKeyDown={(event) => event.key === "Enter" && loadCustomers()}
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
        </section>
      </main>
    </div>
  );
}

function Login({ auth, setAuth, onSubmit, notice }) {
  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="art-label">PIGYWORLD / CRM</div>
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
            <strong>Pigyworld</strong>
            <span>Customer desk</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to your workspace</h2>
          <p className="muted-copy">Use your Pigyworld account to continue.</p>
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
          Protected by your Pigyworld account
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
