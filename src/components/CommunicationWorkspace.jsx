import { useMemo, useState } from "react";
import "./CommunicationWorkspace.css";

const formatTime = (value) => value ? new Date(value).toLocaleString() : "";

function InboxView({ conversations, selectedConversation, onSelectConversation, onReply, onUpdateConversation, staff }) {
  const [draft, setDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const visible = conversations.filter((conversation) => statusFilter === "all" || conversation.status === statusFilter);
  const submit = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    await onReply(message);
    setDraft("");
  };

  return <section className="panel-card communication-workspace-panel">
    <div className="panel-heading">
      <div><div className="eyebrow">Customer service</div><h2>Support inbox</h2></div>
      <select aria-label="Filter support conversations" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
        <option value="open">Open</option><option value="closed">Closed</option><option value="all">All conversations</option>
      </select>
    </div>
    <div className="communication-message-list">
      {visible.length === 0 ? <div className="state-message">No {statusFilter === "all" ? "support" : statusFilter} conversations.</div> : visible.map((conversation) => <button
        className={`communication-message-row conversation-select ${selectedConversation?.id === conversation.id ? "active" : ""}`}
        key={conversation.id}
        type="button"
        onClick={() => onSelectConversation(conversation)}
      >
        <div><strong>{conversation.customer?.name || "Farm member"}</strong><small>{conversation.assigned_agent ? `Assigned to ${conversation.assigned_agent.name}` : "Unassigned"} · {formatTime(conversation.last_message_at)}</small></div>
        <p>{conversation.last_message?.body || "No messages yet."}</p>
        <span>{conversation.unread_count ? `${conversation.unread_count} unread` : conversation.status}</span>
      </button>)}
    </div>
    {selectedConversation && <div className="conversation-detail">
      <div className="panel-heading">
        <div><div className="eyebrow">{selectedConversation.customer?.email || "Farm user"}</div><h3>{selectedConversation.customer?.name || "Farm member"}</h3></div>
        <div className="conversation-controls">
          <label>Assigned agent <select aria-label="Assigned agent" value={selectedConversation.assigned_agent?.id || ""} onChange={(event) => onUpdateConversation({ assigned_user_id: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Unassigned</option>{staff.filter((person) => ["admin", "customer_support"].includes(person.crm_role || (person.role === "farmOwner" ? "admin" : "")) && !person.crm_closed_at).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.crm_role || "admin"})</option>)}
          </select></label>
          <button className="filter-button" type="button" onClick={() => onUpdateConversation({ status: selectedConversation.status === "open" ? "closed" : "open" })}>{selectedConversation.status === "open" ? "Close conversation" : "Reopen"}</button>
        </div>
      </div>
      <div className="conversation-transcript" aria-live="polite">
        {(selectedConversation.messages || []).map((message) => <article className={`conversation-message ${message.sender_role === "crm" ? "outgoing" : "incoming"}`} key={message.id}>
          <div><strong>{message.sender_name || (message.sender_role === "crm" ? "Customer Support" : "Farm member")}</strong><time>{formatTime(message.created_at)}</time></div><p>{message.body}</p>
        </article>)}
      </div>
      {selectedConversation.status === "open" && <form className="communication-composer" onSubmit={submit}>
        <textarea required rows="3" maxLength="4000" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Reply as the signed-in support agent" />
        <button className="primary-button" type="submit">Send reply</button>
      </form>}
    </div>}
  </section>;
}

function BroadcastView({ farmMembers, history, notification, setNotification, onSubmit, canNotify }) {
  const recipients = useMemo(() => farmMembers.filter((member) => ["farmOwner", "farmManager", "farmWorker"].includes(member.role)), [farmMembers]);
  const recipientCount = notification.recipient_id ? 1 : recipients.length;
  if (!canNotify) return <section className="panel-card communication-workspace-panel"><div className="eyebrow">Broadcast</div><h2>Read-only communication access</h2><p className="communication-muted">Your role can read communication messages but cannot send broadcasts.</p></section>;
  return <section className="panel-card communication-workspace-panel">
    <div className="panel-heading"><div><div className="eyebrow">Announcements</div><h2>Send a broadcast</h2></div><span>Not a support reply</span></div>
    <form className="communication-composer" onSubmit={onSubmit}>
      <label>Audience <select value={notification.recipient_id} onChange={(event) => setNotification((current) => ({ ...current, recipient_id: event.target.value }))}>
        <option value="">Everyone in this farm ({recipients.length})</option>{recipients.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}
      </select></label>
      <input maxLength="160" value={notification.title || ""} onChange={(event) => setNotification((current) => ({ ...current, title: event.target.value }))} placeholder="Announcement title (optional)" />
      <textarea required rows="5" maxLength="1000" value={notification.message} onChange={(event) => setNotification((current) => ({ ...current, message: event.target.value }))} placeholder="Write an announcement" />
      <p className="communication-muted">This will create an in-app notification for {recipientCount} {recipientCount === 1 ? "recipient" : "recipients"}.</p>
      <button className="primary-button" type="submit">Send broadcast</button>
    </form>
    <div className="panel-heading"><div><div className="eyebrow">Audit history</div><h3>Recent broadcasts</h3></div><span>{history.length} recent</span></div>
    {history.length === 0 ? <div className="state-message">No broadcasts have been sent.</div> : <div className="communication-message-list">{history.map((item) => <article className="communication-message-row" key={item.id}><div><strong>{item.title}</strong><small>By {item.sender_name} · {formatTime(item.created_at)}</small></div><p>{item.message}</p><span>{item.audience === "farm" ? `Farm-wide · ${item.recipient_count} recipients` : `To ${item.recipient_name || "one member"}`} · {item.push_sent_count || 0} push sent</span></article>)}</div>}
  </section>;
}

function ActivityView({ selected, interactions, canReply }) {
  return <section className="panel-card communication-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Customer activity</div><h2>{selected ? `${selected.name} timeline` : "Customer communication"}</h2></div><span>{selected ? "Selected from Customers" : "No customer selected"}</span></div>{!selected ? <div className="state-message">Select a customer in the Customers workspace to review communication activity.</div> : interactions.length === 0 ? <div className="state-message">No customer activity recorded yet.</div> : <div className="timeline">{interactions.map((item) => <div className="timeline-item" key={item.id || `${item.type}-${item.occurred_at}`}><span className="timeline-icon">{item.type === "call" ? "⌕" : item.type === "email" ? "@" : "✦"}</span><div><strong>{item.type[0].toUpperCase() + item.type.slice(1)}</strong><span>{item.notes || "No notes added"}</span></div><time>{new Date(item.occurred_at).toLocaleString()}</time></div>)}</div>}{selected && !canReply && <p className="communication-muted">Your role can review activity but cannot add customer replies.</p>}</section>;
}

function TemplatesView({ templates, onUse, hasCustomer }) {
  return <section className="panel-card communication-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Quick actions</div><h2>Communication templates</h2></div><span>Save a customer follow-up</span></div>{!hasCustomer && <div className="state-message">Select a customer in the Customers workspace before using a template.</div>}<div className="automation-grid">{templates.map((template) => <button key={template.label} type="button" className="automation-card" disabled={!hasCustomer} onClick={() => onUse(template)}><strong>{template.label}</strong><span>{template.copy}</span></button>)}</div></section>;
}

export function CommunicationWorkspace({ view, conversations, selectedConversation, onSelectConversation, onReply, onUpdateConversation, staff, farmMembers, history, notification, setNotification, onSubmit, selected, interactions, templates, onUseTemplate, canNotify, canReply, canRead }) {
  if (!canRead) return <section className="panel-card communication-workspace-panel"><div className="eyebrow">Communication</div><h2>Access restricted</h2><p className="communication-muted">Your role does not have access to CRM communication.</p></section>;
  if (view === "communication-broadcast") return <BroadcastView farmMembers={farmMembers} history={history} notification={notification} setNotification={setNotification} onSubmit={onSubmit} canNotify={canNotify} />;
  if (view === "communication-activity") return <ActivityView selected={selected} interactions={interactions} canReply={canReply} />;
  if (view === "communication-templates") return <TemplatesView templates={templates} onUse={onUseTemplate} hasCustomer={Boolean(selected)} />;
  return <InboxView conversations={conversations} selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} onReply={onReply} onUpdateConversation={onUpdateConversation} staff={staff} />;
}
