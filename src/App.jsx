import { useEffect, useMemo, useState } from "react";
import { api, clearSession, ROLE_KEY, saveProfile, saveSession, TOKEN_KEY } from "./api";
import "./customer-workspace.css";
import { AdminNavbar } from "./components/AdminNavbar";
import { CustomerSidebar } from "./components/CustomerSidebar";
import { HomeDashboard } from "./components/HomeDashboard";
import { DirectoryView } from "./components/DirectoryView";
import { OrdersView } from "./components/OrdersView";
import { PipelineBoard } from "./components/PipelineBoard";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { Login } from "./components/Login";
import { SplashScreen } from "./components/SplashScreen";
import { CustomerForm } from "./components/CustomerForm";
import { TaskPanel } from "./components/TaskPanel";
const emptyCustomer = {
  farm_id: "",
  assigned_user_id: "",
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
const segmentDefinitions = [
  { id: "hot", label: "Hot leads", description: "Fresh opportunities ready for follow-up", predicate: (customer) => ["new", "contacted"].includes(customer.status) },
  { id: "priority", label: "Priority buyers", description: "Qualified prospects with strong conversion potential", predicate: (customer) => customer.type === "buyer" || customer.status === "qualified" },
  { id: "retained", label: "Retained accounts", description: "Won opportunities and active accounts", predicate: (customer) => customer.status === "won" },
  { id: "at-risk", label: "At risk", description: "Leads that need attention before they go cold", predicate: (customer) => customer.status === "lost" || customer.status === "contacted" },
];
const communicationTemplates = [
  { label: "Welcome message", type: "message", copy: "Welcome to Pig World. We are ready to help you with pricing, delivery, and herd planning." },
  { label: "Follow-up nudge", type: "email", copy: "Following up on our last conversation. Please confirm the best time for a call or quote review." },
  { label: "Delivery check", type: "call", copy: "Checking in on the delivery schedule and any remaining questions before the next order." },
  { label: "Win confirmation", type: "note", copy: "Thanks for choosing Pig World. We’ve confirmed the next steps for onboarding and account activation." },
];
function App() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: "", notes: "", due_at: "", priority: "normal", assigned_to: "" });
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const [form, setForm] = useState(emptyCustomer);
  const [interaction, setInteraction] = useState({ type: "message", notes: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [farmId, setFarmId] = useState("");
  const [staff, setStaff] = useState([]);
  const [crmMessages, setCrmMessages] = useState([]);
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
  const [importText, setImportText] = useState("");
  const [activeSection, setActiveSection] = useState("home");
  const [activeView, setActiveView] = useState("customers");
  const [customerGroups, setCustomerGroups] = useState({ myCustomers: true, orders: false });
  const [calculator, setCalculator] = useState({
    customers: "",
    amount: "",
  });
  const [report, setReport] = useState(null);
  const [plans, setPlans] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [directory, setDirectory] = useState(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [orders, setOrders] = useState({ data: [], meta: null });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [showSplash, setShowSplash] = useState(true);
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
  const leadNextAction = useMemo(() => {
    if (!selected) return "";
    switch (selected.status) {
      case "new":
        return "Call the lead, confirm needs, and record the first touch.";
      case "contacted":
        return "Send the proposal or quote and confirm the buying timeline.";
      case "qualified":
        return "Arrange the delivery plan, subscription details, or follow-up meeting.";
      case "won":
        return "Activate the account and capture the success handoff.";
      case "lost":
        return "Document the reason and keep the opportunity for future re-engagement.";
      default:
        return "Log the next move and keep the relationship moving.";
    }
  }, [selected]);
  const lastInteraction = useMemo(() => interactions[0] || null, [interactions]);
  const segmentSummary = useMemo(
    () =>
      segmentDefinitions.reduce((result, segment) => {
        result[segment.id] = customers.filter(segment.predicate);
        return result;
      }, {}),
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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const parseCsvLine = (line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const importCustomersFromCsv = async (event) => {
    event.preventDefault();
    if (!importText.trim()) {
      return showNotice("Paste or upload customer rows before importing.", "error");
    }
    if (!farmId) {
      return showNotice("Your account is not linked to a farm.", "error");
    }
    const rows = importText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map(parseCsvLine);
    if (rows.length < 2) {
      return showNotice("Add at least a header row and one customer row.", "error");
    }
    const headers = rows[0].map((header) => header.toLowerCase().trim());
    const imported = [];
    for (const row of rows.slice(1)) {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
      const payload = {
        farm_id: Number(farmId),
        name: record.name || record.company || record.customer || "Imported customer",
        email: record.email || record.contact_email || "",
        phone: record.phone || record.mobile || record.contact_phone || "",
        company: record.company || record.business || "",
        address: record.address || record.location || "",
        type: ["buyer", "supplier"].includes((record.type || "").toLowerCase()) ? record.type.toLowerCase() : "lead",
        status: ["new", "contacted", "qualified", "won", "lost"].includes((record.status || "").toLowerCase()) ? record.status.toLowerCase() : "new",
        notes: record.notes || `Imported from CSV on ${new Date().toLocaleDateString()}`,
      };
      try {
        const response = await api.post("/crm/customers", payload);
        imported.push(response.data.data);
      } catch (error) {
        const fallbackCustomer = {
          id: `csv-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...payload,
        };
        imported.push(fallbackCustomer);
        showNotice(
          error.response?.data?.message || "One or more rows were saved locally while syncing.",
          "warning",
        );
      }
    }
    setCustomers((current) => [...imported, ...current]);
    setImportText("");
    setSelectedId(imported[0]?.id || null);
    showNotice(`Imported ${imported.length} customer records.`, "success");
  };
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
    Promise.all([
      api.get(`/crm/customers/${selected.id}/interactions`),
      api.get(`/crm/customers/${selected.id}/tasks`),
      api.get(`/crm/customers/${selected.id}/timeline`),
    ])
      .then(([interactionResponse, taskResponse, timelineResponse]) => {
        setInteractions(interactionResponse.data?.data || []);
        setTasks(taskResponse.data?.data || []);
        setTimeline(timelineResponse.data?.data || []);
      })
      .catch(() => showNotice("Unable to load customer workflow history.", "error"));
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
      await loadCustomerWorkflow(selected.id);
      setInteraction({ type: "message", notes: "" });
      showNotice("Reply logged.", "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not log reply.",
        "error",
      );
    }
  };
  const loadCustomerWorkflow = async (customerId) => {
    const [interactionResponse, taskResponse, timelineResponse] = await Promise.all([
      api.get(`/crm/customers/${customerId}/interactions`),
      api.get(`/crm/customers/${customerId}/tasks`),
      api.get(`/crm/customers/${customerId}/timeline`),
    ]);
    setInteractions(interactionResponse.data?.data || []);
    setTasks(taskResponse.data?.data || []);
    setTimeline(timelineResponse.data?.data || []);
  };
  const saveTask = async (event) => {
    event.preventDefault();
    if (!selected || !taskForm.title.trim()) return;
    try {
      const response = await api.post(`/crm/customers/${selected.id}/tasks`, {
        ...taskForm,
        assigned_to: taskForm.assigned_to || null,
        due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null,
      });
      setTasks((current) => [response.data.data, ...current]);
      setTaskForm({ title: "", notes: "", due_at: "", priority: "normal", assigned_to: "" });
      await loadCustomerWorkflow(selected.id);
      showNotice("Follow-up task created.", "success");
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not create the task.", "error");
    }
  };
  const updateTaskStatus = async (task, status) => {
    try {
      await api.patch(`/crm/customers/${selected.id}/tasks/${task.id}`, { status });
      await loadCustomerWorkflow(selected.id);
      showNotice(status === "completed" ? "Task completed." : "Task reopened.", "success");
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not update the task.", "error");
    }
  };
  const addQuickAutomation = async (template) => {
    if (!selected) {
      return showNotice("Select a customer before using a communication shortcut.", "error");
    }
    try {
      const response = await api.post(
        `/crm/customers/${selected.id}/interactions`,
        {
          type: template.type,
          notes: template.copy,
          occurred_at: new Date().toISOString(),
        },
      );
      setInteractions((current) => [response.data.data, ...current]);
      showNotice(`${template.label} saved to ${selected.name}.`, "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not save the automation action.",
        "error",
      );
    }
  };
  const updateCustomerStatus = async (customerOrStatus, requestedStatus) => {
    const customer = typeof customerOrStatus === "object" ? customerOrStatus : selected;
    const nextStatus = requestedStatus || customerOrStatus;
    if (!customer || nextStatus === customer.status) return;
    try {
      const response = await api.put(`/crm/customers/${customer.id}`, {
        ...customer,
        status: nextStatus,
        farm_id: Number(customer.farm_id || farmId || 0),
      });
      const updated = response.data.data;
      setCustomers((current) =>
        current.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      setSelectedId(updated.id);
      await loadCustomerWorkflow(updated.id);
      showNotice(`Customer moved to ${nextStatus}.`, "success");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not update the lead status.",
        "error",
      );
    }
  };
  const loadStaff = async () => {
    if (!auth.token || !farmId) return;
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
  const loadCrmMessages = async () => {
    if (!auth.token || !farmId || !canNotify) return;
    try {
      const response = await api.get("/crm/notifications", { params: { farm_id: farmId } });
      setCrmMessages(response.data?.data || []);
    } catch (error) {
      showNotice(error.response?.data?.message || "Unable to load CRM messages.", "error");
    }
  };
  const loadDashboard = async () => {
    if (!auth.token || !farmId) return;
    try {
      setDashboardLoading(true);
      setDashboardError("");
      const response = await api.get("/crm/dashboard/overview", { params: { farm_id: farmId } });
      setDashboard(response.data?.data || null);
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load the CRM dashboard.";
      setDashboardError(message);
    } finally {
      setDashboardLoading(false);
    }
  };
  const loadDirectory = async () => {
    if (!auth.token) return;
    try {
      setDirectoryLoading(true);
      setDirectoryError("");
      const response = await api.get("/crm/directories/overview");
      setDirectory(response.data?.data || null);
    } catch (error) {
      setDirectoryError(error.response?.data?.message || "Unable to load customer directories.");
    } finally {
      setDirectoryLoading(false);
    }
  };
  const loadOrders = async (status) => {
    if (!auth.token) return;
    try {
      setOrdersLoading(true);
      setOrdersError("");
      const response = await api.get("/crm/orders", { params: { status, per_page: 25 } });
      setOrders({ data: response.data?.data || [], meta: response.data?.meta || null });
    } catch (error) {
      setOrdersError(error.response?.data?.message || "Unable to load customer orders.");
    } finally {
      setOrdersLoading(false);
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
      await loadCrmMessages();
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
    if (auth.token) {
      loadStaff();
      loadCrmMessages();
      loadDashboard();
      loadDirectory();
    }
  }, [auth.token, farmId]);

  useEffect(() => {
    if (!auth.token || !activeView.startsWith("orders-")) return;
    loadOrders(activeView.replace("orders-", ""));
  }, [auth.token, activeView]);

  if (showSplash) {
    return <SplashScreen />;
  }

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
        {activeSection === "customers" && (
          <CustomerSidebar
            activeView={activeView}
            setActiveView={setActiveView}
            customerGroups={customerGroups}
            setCustomerGroups={setCustomerGroups}
          />
        )}
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
        <AdminNavbar activeSection={activeSection} selectSection={selectSection} />
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
        {activeSection === "home" && <HomeDashboard dashboard={dashboard} loading={dashboardLoading} error={dashboardError} onRefresh={loadDashboard} onOpen={selectSection} onOpenStatus={(status) => { setFilters({ search: "", status }); selectSection("customers"); }} />}
        {activeSection === "customers" && ["farm-owners", "farm-managers", "farm-workers", "relationships"].includes(activeView) && <DirectoryView view={activeView} directory={directory} loading={directoryLoading} error={directoryError} onRefresh={loadDirectory} />}
        {activeSection === "customers" && activeView.startsWith("orders-") && <OrdersView status={activeView.replace("orders-", "")} orders={orders} loading={ordersLoading} error={ordersError} onRefresh={() => loadOrders(activeView.replace("orders-", ""))} />}
        {canNotify && activeSection === "communication" && <section className="panel-card crm-tools">
          <div className="panel-heading"><div><div className="eyebrow">Broadcast</div><h2>Send notification</h2></div><span>All staff or one person</span></div>
          <form className="interaction-composer" onSubmit={sendNotification}>
            <select value={notification.recipient_id} onChange={(event) => setNotification((current) => ({ ...current, recipient_id: event.target.value }))}><option value="">Everyone in this farm</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.crm_role || member.role})</option>)}{crmMessages.filter((message) => message.sender_id && !staff.some((member) => String(member.id) === String(message.sender_id))).map((message) => <option key={`app-${message.sender_id}`} value={message.sender_id}>{message.sender_name || message.sender_email || "Farm member"} (app user)</option>)}</select>
            <input required value={notification.message} onChange={(event) => setNotification((current) => ({ ...current, message: event.target.value }))} placeholder="Write a notification message" />
            <button className="primary-button" type="submit">Send</button>
          </form>
          <div className="crm-message-inbox">
            <div className="panel-heading"><div><div className="eyebrow">Inbox</div><h2>Messages from the farm app</h2></div><button className="filter-button" type="button" onClick={loadCrmMessages}>Refresh</button></div>
            {crmMessages.length === 0 ? <div className="state-message">No messages from app users yet.</div> : crmMessages.map((message) => <article className="crm-message" key={message.id}><div><strong>{message.sender_name || "Farm member"}</strong><small>{message.sender_email || ""} · {new Date(message.created_at).toLocaleString()}</small></div><p>{message.message}</p><button className="ghost-button" type="button" onClick={() => setNotification((current) => ({ ...current, recipient_id: message.sender_id, message: `Hi ${message.sender_name || "there"}, ` }))}>Reply</button></article>)}
          </div>
          <div className="automation-panel">
            <div className="panel-heading"><div><div className="eyebrow">Automation</div><h2>Quick customer follow-up</h2></div><span>Save a note in one click</span></div>
            <div className="automation-grid">
              {communicationTemplates.map((template) => (
                <button key={template.label} type="button" className="automation-card" onClick={() => addQuickAutomation(template)}>
                  <strong>{template.label}</strong>
                  <span>{template.copy}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="activity-mini-panel">
            <div className="panel-heading"><div><div className="eyebrow">Recent activity</div><h2>{selected ? `${selected.name} timeline` : "Customer activity"}</h2></div><span>{selected ? "Live history" : "Select a lead"}</span></div>
            {selected ? (
              <div className="timeline compact">
                {interactions.length === 0 ? (
                  <div className="state-message">No customer activity yet.</div>
                ) : (
                  interactions.slice(0, 5).map((item) => (
                    <div className="timeline-item" key={item.id || `${item.type}-${item.occurred_at}`}>
                      <span className="timeline-icon">{item.type === "call" ? "⌕" : item.type === "email" ? "@" : "✦"}</span>
                      <div>
                        <strong>{item.type[0].toUpperCase() + item.type.slice(1)}</strong>
                        <span>{item.notes || "No notes added"}</span>
                      </div>
                      <time>{new Date(item.occurred_at).toLocaleDateString()}</time>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="state-message">Choose a customer from the customer desk to review their communication history.</div>
            )}
          </div>
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
            statuses={statuses}
          />
        )}
        {activeSection === "customers" && activeView === "pipeline" && (
          <PipelineBoard customers={customers} onSelect={setSelectedId} onMove={updateCustomerStatus} statuses={statuses} />
        )}
        {activeSection === "customers" && activeView === "segments" && (
          <section className="panel-card crm-tools">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Classification</div>
                <h2>Customer segments</h2>
              </div>
              <span>{customers.length} records</span>
            </div>
            <div className="segment-grid">
              {segmentDefinitions.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className="segment-card"
                  onClick={() => {
                    setFilters({ search: "", status: "all" });
                    setActiveView("customers");
                    setSelectedId(segmentSummary[segment.id][0]?.id || null);
                  }}
                >
                  <div className="segment-header">
                    <strong>{segment.label}</strong>
                    <span>{segmentSummary[segment.id].length}</span>
                  </div>
                  <p>{segment.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        {activeSection === "customers" && activeView === "import" && (
          <section className="panel-card crm-tools">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Bulk import</div>
                <h2>Import customers from CSV</h2>
              </div>
              <span>Use headers: name, email, phone, company, address, type, status</span>
            </div>
            <form className="import-form" onSubmit={importCustomersFromCsv}>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="name,email,phone,company,address,type,status\nAmara Foods,amara@farm.com,+254700000001,Amara Foods,Nakuru,buyer,qualified"
                rows="10"
              />
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => setImportText("")}>Clear</button>
                <button className="primary-button" type="submit">Import records</button>
              </div>
            </form>
          </section>
        )}
        {activeSection === "customers" && activeView === "customers" && <section className="stats-row">
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
        {activeSection === "customers" && activeView === "customers" && <section className="workspace-grid">
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
                        {customer.farm_name || customer.company ||
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
                staff={staff}
                statuses={statuses}
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
                  <div className="company-overview-grid">
                    <div className="company-overview-item">
                      <span>Business profile</span>
                      <strong>{selected.company || "Independent contact"}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Type</span>
                      <strong>{selected.type}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Last touch</span>
                      <strong>{lastInteraction ? new Date(lastInteraction.occurred_at).toLocaleDateString() : "No activity yet"}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Next action</span>
                      <strong>{leadNextAction}</strong>
                    </div>
                  </div>
                  <div className="company-overview-grid">
                    <div className="company-overview-item">
                      <span>Business profile</span>
                      <strong>{selected.company || "Independent contact"}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Type</span>
                      <strong>{selected.type}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Last touch</span>
                      <strong>{lastInteraction ? new Date(lastInteraction.occurred_at).toLocaleDateString() : "No activity yet"}</strong>
                    </div>
                    <div className="company-overview-item">
                      <span>Next action</span>
                      <strong>{leadNextAction}</strong>
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
                  <div className="lead-journey">
                    <div>
                      <span>Lead lifecycle</span>
                      <strong>{selected.status}</strong>
                    </div>
                    <div className="status-action-row">
                      {statuses.slice(1).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={selected.status === status ? "status-pill active" : "status-pill"}
                          onClick={() => updateCustomerStatus(status)}
                          disabled={selected.status === status}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="next-step-card">
                    <span>Suggested next step</span>
                    <p>{leadNextAction}</p>
                  </div>
                  {selected.notes && (
                    <div className="notes">
                      <span>Notes</span>
                      <p>{selected.notes}</p>
                    </div>
                  )}
                </section>
                <TaskPanel
                  tasks={tasks}
                  taskForm={taskForm}
                  setTaskForm={setTaskForm}
                  staff={staff}
                  onSubmit={saveTask}
                  onToggle={updateTaskStatus}
                />
                <section className="activity-card panel-card">
                  <div className="panel-heading">
                    <div>
                      <h2>Activity timeline</h2>
                      <span>Keep every conversation in context</span>
                    </div>
                    <span className="activity-count">
                      {timeline.length} events
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
                    {timeline.length === 0 ? (
                      <div className="state-message">
                        No activity recorded yet.
                      </div>
                    ) : (
                      timeline.map((item) => (
                        <div className="timeline-item" key={item.id}>
                          <span className="timeline-icon">
                            {item.subtype === "call"
                              ? "⌕"
                              : item.subtype === "email"
                                ? "@"
                                : "✦"}
                          </span>
                          <div>
                            <strong>
                              {(item.subtype || item.type).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                            </strong>
                            <span>{item.notes || item.data?.title || item.data?.to || "No notes added"}</span>
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
