const permissionOptions = [
  ["viewDashboard", "View dashboard"],
  ["manageHerd", "Manage herd"],
  ["manageFinance", "Manage finance"],
  ["manageSales", "Manage sales"],
  ["viewReports", "View reports"],
  ["manageSettings", "Manage settings"],
  ["manageMembers", "Manage members"],
  ["managePolicies", "Manage policies"],
];

function ProfileView({ user, profileForm, setProfileForm, onSave }) {
  return <section className="panel-card settings-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Account</div><h2>My profile</h2></div><span>{user?.crm_role || user?.role || "CRM account"}</span></div><form className="settings-form" onSubmit={onSave}><label>Display name<input required value={profileForm.name} onChange={(event) => setProfileForm({ name: event.target.value })} /></label><label>Email<input value={user?.email || ""} disabled /></label><label>Phone<input value={user?.phone || "Not provided"} disabled /></label><button className="primary-button" type="submit">Save profile</button></form><p className="settings-note">Email, phone, avatar, and timezone changes are not available from the current account API.</p></section>;
}

function SecurityView({ passwordForm, setPasswordForm, onSave }) {
  return <section className="panel-card settings-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Account protection</div><h2>Password and security</h2></div><span>Keep your account protected</span></div><form className="settings-form settings-security-form" onSubmit={onSave}><label>Current password<input required type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} /></label><label>New password<input required minLength="8" type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))} /></label><label>Confirm new password<input required minLength="8" type="password" value={passwordForm.new_password_confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password_confirmation: event.target.value }))} /></label><button className="primary-button" type="submit">Change password</button></form><div className="settings-security-note"><strong>Session security</strong><span>The CRM signs you out after a period of inactivity.</span></div></section>;
}

function FarmView({ farm, farmName, setFarmName, onSave, canEdit }) {
  if (!farm) return <section className="panel-card settings-workspace-panel"><div className="state-message">No farm workspace is linked to this account.</div></section>;
  return <section className="panel-card settings-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Workspace</div><h2>Farm workspace</h2></div><span>Farm #{farm.id}</span></div><form className="settings-form" onSubmit={onSave}><label>Farm name<input required disabled={!canEdit} value={farmName} onChange={(event) => setFarmName(event.target.value)} /></label>{canEdit && <button className="primary-button" type="submit">Save farm name</button>}</form><div className="settings-detail-grid"><div><span>Location</span><strong>{farm.location || "Not provided"}</strong></div><div><span>Mother pigs</span><strong>{farm.mother_pig_count ?? 0}</strong></div><div><span>Subscription</span><strong>{farm.subscription_plan || "No active plan"}</strong></div><div><span>Invite code</span><strong>{farm.invite_code || "Not available"}</strong></div></div><p className="settings-note">Only the farm name can currently be changed from this workspace.</p></section>;
}

function MembersView({ members, canManage, memberPermissions, setMemberPermissions, onSave }) {
  return <section className="panel-card settings-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Access control</div><h2>Members and permissions</h2></div><span>{members.length} members</span></div>{members.length === 0 ? <div className="state-message">No farm members found.</div> : <div className="settings-member-list">{members.map((member) => <article className="settings-member-row" key={member.id}><div><strong>{member.name}</strong><span>{member.email} · {member.role}</span></div>{member.role === "farmOwner" ? <span className="settings-owner-badge">Owner</span> : <div className="permission-editor">{permissionOptions.map(([value, label]) => <label key={value}><input type="checkbox" disabled={!canManage} checked={(memberPermissions[member.id] || []).includes(value)} onChange={(event) => setMemberPermissions((current) => ({ ...current, [member.id]: event.target.checked ? [...(current[member.id] || []), value] : (current[member.id] || []).filter((permission) => permission !== value) }))} />{label}</label>)}{canManage && <button className="filter-button" type="button" onClick={() => onSave(member)}>Save permissions</button>}</div>}</article>)}</div>}</section>;
}

function NotificationsView({ notifications, onRefresh, onRead }) {
  return <section className="panel-card settings-workspace-panel"><div className="panel-heading"><div><div className="eyebrow">Farm notifications</div><h2>Notifications</h2></div><button className="filter-button" type="button" onClick={onRefresh}>Refresh</button></div>{notifications.length === 0 ? <div className="state-message">No farm notifications for this account.</div> : <div className="settings-notification-list">{notifications.map((notification) => <article className={`settings-notification-row ${notification.read_at ? "read" : "unread"}`} key={notification.id}><div><strong>{notification.title || notification.type || "Notification"}</strong><span>{notification.body || notification.message}</span><small>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ""}</small></div>{!notification.read_at && <button className="filter-button" type="button" onClick={() => onRead(notification)}>Mark read</button>}</article>)}</div>}<p className="settings-note">CRM inbox messages use a separate system and do not currently support read status.</p></section>;
}

export function SettingsWorkspace({ view, user, profileForm, setProfileForm, onSaveProfile, passwordForm, setPasswordForm, onChangePassword, farm, farmName, setFarmName, onSaveFarm, canEditFarm, members, canManageMembers, memberPermissions, setMemberPermissions, onSaveMember, notifications, onRefreshNotifications, onReadNotification }) {
  if (view === "settings-security") return <SecurityView passwordForm={passwordForm} setPasswordForm={setPasswordForm} onSave={onChangePassword} />;
  if (view === "settings-farm") return <FarmView farm={farm} farmName={farmName} setFarmName={setFarmName} onSave={onSaveFarm} canEdit={canEditFarm} />;
  if (view === "settings-members") return <MembersView members={members} canManage={canManageMembers} memberPermissions={memberPermissions} setMemberPermissions={setMemberPermissions} onSave={onSaveMember} />;
  if (view === "settings-notifications") return <NotificationsView notifications={notifications} onRefresh={onRefreshNotifications} onRead={onReadNotification} />;
  return <ProfileView user={user} profileForm={profileForm} setProfileForm={setProfileForm} onSave={onSaveProfile} />;
}
