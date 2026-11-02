import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, Globe, Layers, LogOut, Settings, Shield, Users } from "lucide-react";
import {
  changePin,
  checkAccess,
  clearDeviceToken,
  clearSession,
  createAllowedIp,
  createFeedback,
  createModule,
  createDepartment,
  updateModule,
  updateDepartment,
  createUser,
  deleteAllowedIp,
  deleteFeedback,
  deleteUser,
  fetchAllowedIps,
  fetchDevices,
  fetchDepartments,
  fetchSecurityEvents,
  fetchUsers,
  deleteModule,
  deleteDepartment,
  fetchFeedback,
  fetchMe,
  fetchModules,
  fetchScreenshot,
  login,
  logout,
  readSession,
  readDeviceToken,
  registerDevice,
  requestOtp,
  resetPinWithOtp,
  revokeDevice,
  verifyOtp,
  updateFeedback,
  updateProfile,
  updateStatus,
  updateUser,
  writeDeviceToken,
  writeSession,
} from "./api";
import { exportFeedbackPdf } from "./exportPdf";
import { ModuleMark, IconPicker } from "./moduleIcons";
import { CATEGORIES, STATUSES, categoryById } from "./labels";
import "./App.css";

const ROLES = [
  { id: "ADMIN", label: "Admin" },
  { id: "DEVELOPER", label: "Developer" },
  { id: "REPORTER", label: "Reporter" },
];

function roleLabel(id) {
  return ROLES.find((role) => role.id === id)?.label || "Admin";
}

function manageTitle(view, fallback) {
  if (view === "users") return "Users";
  if (view === "departments") return "Departments";
  if (view === "modules") return "Modules";
  if (view) return "Manage";
  return fallback;
}

function manageDescription(view, fallback) {
  if (view === "users") return "Accounts that can sign in. Each person belongs to one department.";
  if (view === "departments") return "Departments used when feedback is registered. Each one appears in the sidebar.";
  if (view === "modules") return "Modules are shared. Feedback under a module is separated by department.";
  if (view) return "Networks, people, departments, modules, and the security log.";
  return fallback;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function byNewest(left, right) {
  return String(right?.createdAt || "").localeCompare(String(left?.createdAt || ""));
}

const emptyModuleForm = { name: "", description: "", icon: "" };
const emptyFeedbackForm = {
  moduleId: "",
  title: "",
  details: "",
  category: "LEGACY_PARITY",
  status: "IN_PROGRESS",
  origin: "REVIEW",
};

function formatCreated(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function matchesQuery(item, query) {
  if (!query) return true;
  const haystack = `${item.title} ${item.details} ${item.moduleName}`.toLowerCase();
  return haystack.includes(query);
}

function categoryMatches(item, selectedCategory) {
  if (selectedCategory === "all") return true;
  return item.category === selectedCategory;
}

function Dashboard({ user, onSignOut, onUserUpdated }) {
  const [modules, setModules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [openMenus, setOpenMenus] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleId, setModuleId] = useState("all");
  const [origin, setOrigin] = useState("DASHBOARD");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [manageView, setManageView] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [networksOpen, setNetworksOpen] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const role = user.role || "ADMIN";
  const canDelete = user.username === "bulxan";
  const canManageUsers = user.username === "bulxan";
  const canCreateModule = role === "ADMIN";
  const canManage = role === "ADMIN";
  const canCreateFeedback = role === "ADMIN" || role === "REPORTER";
  const canEdit = role === "ADMIN";
  const canChangeStatus = role === "ADMIN" || role === "DEVELOPER";
  const canRegister = canCreateModule || canCreateFeedback;
  const selectedDepartment = departments.find((entry) => entry.id === origin);
  const collection = origin === "DASHBOARD"
    ? {
        title: "Dashboard",
        label: "all feedback",
        description: "All feedback, with the newest record first.",
        register: "Register feedback",
      }
    : {
        title: selectedDepartment?.name || "Department",
        label: selectedDepartment?.name || "department",
        description: `Feedback reported by ${selectedDepartment?.name || "this department"}.`,
        register: "Register feedback",
      };

  async function load() {
    const [nextModules, nextItems, nextDepartments] = await Promise.all([fetchModules(), fetchFeedback(), fetchDepartments()]);
    setModules(nextModules);
    setItems(nextItems);
    setDepartments(nextDepartments);
    setOpenMenus((current) => {
      if (Object.keys(current).length > 0) return current;
      return user.departmentId ? { [user.departmentId]: true } : {};
    });
  }

  useEffect(() => {
    load()
      .catch((loadError) => {
        if (loadError.status === 401) onSignOut();
        else setError(loadError.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const moduleCounts = useMemo(() => {
    const counts = {};
    departments.forEach((department) => {
      counts[department.id] = {};
      modules.forEach((module) => {
        counts[department.id][module.id] = 0;
      });
    });
    items.forEach((item) => {
      if (!item.departmentId || !counts[item.departmentId]) return;
      const statusOk = status === "all" || item.status === status;
      if (!statusOk || !matchesQuery(item, normalizedQuery)) return;
      counts[item.departmentId][item.moduleId] = (counts[item.departmentId][item.moduleId] || 0) + 1;
    });
    return counts;
  }, [items, modules, departments, status, normalizedQuery]);

  const areaCounts = useMemo(() => {
    let total = 0;
    items.forEach((item) => {
      const statusOk = status === "all" || item.status === status;
      if (statusOk && matchesQuery(item, normalizedQuery)) total += 1;
    });
    return { DASHBOARD: total };
  }, [items, status, normalizedQuery]);

  const categoryCounts = useMemo(() => {
    const counts = { all: 0 };
    CATEGORIES.forEach((entry) => {
      counts[entry.id] = 0;
    });
    items.forEach((item) => {
      const moduleOk = moduleId === "all" || item.moduleId === moduleId;
      const statusOk = status === "all" || item.status === status;
      if (includesOrigin(origin, item) && moduleOk && statusOk && matchesQuery(item, normalizedQuery)) {
        counts.all += 1;
        counts[item.category] += 1;
      }
    });
    return counts;
  }, [items, moduleId, origin, status, normalizedQuery]);

  const statusCounts = useMemo(() => {
    const counts = {};
    STATUSES.forEach((entry) => {
      counts[entry.id] = 0;
    });
    items.forEach((item) => {
      const moduleOk = moduleId === "all" || item.moduleId === moduleId;
      const categoryOk = categoryMatches(item, category);
      if (includesOrigin(origin, item) && moduleOk && categoryOk && matchesQuery(item, normalizedQuery)) {
        counts[item.status] += 1;
      }
    });
    return counts;
  }, [items, moduleId, origin, category, normalizedQuery]);

  const visible = items.filter((item) => {
    const moduleOk = moduleId === "all" || item.moduleId === moduleId;
    const categoryOk = categoryMatches(item, category);
    const statusOk = status === "all" || item.status === status;
    return includesOrigin(origin, item) && moduleOk && categoryOk && statusOk && matchesQuery(item, normalizedQuery);
  });

  const groups = [];
  if (origin === "DASHBOARD") {
    if (visible.length > 0) {
      groups.push({
        moduleId: "flat",
        moduleName: "",
        moduleIcon: "",
        flat: true,
        items: [...visible].sort(byNewest),
      });
    }
  } else {
    visible.forEach((item) => {
      let group = groups.find((entry) => entry.moduleId === item.moduleId);
      if (!group) {
        group = {
          moduleId: item.moduleId,
          moduleName: item.moduleName,
          moduleIcon: item.moduleIcon,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(item);
    });
    groups.forEach((group) => group.items.sort(byNewest));
    groups.sort((left, right) => byNewest(left.items[0], right.items[0]));
  }

  const selectedModule = modules.find((module) => module.id === moduleId);
  const summary = moduleId === "all" && category === "all" && status === "all" && !normalizedQuery
    ? (origin === "DASHBOARD" ? "Showing all feedback" : `Showing ${selectedDepartment?.name || "department"} feedback`)
    : `Showing ${category === "all" ? "all feedback" : categoryById(category).label}${
        status === "all" ? "" : `, ${STATUSES.find((entry) => entry.id === status).label.toLowerCase()}`
      }${origin !== "DASHBOARD" && selectedModule ? ` in ${selectedModule.name}` : ""}`;

  async function changeStatus(item, nextStatus) {
    if (item.status === nextStatus) return;
    setPendingId(item.id);
    setError("");
    try {
      const updated = await updateStatus(item.id, nextStatus);
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setPendingId(null);
    }
  }

  const typeLabel = category === "all" ? "All feedback" : categoryById(category).label;
  const moduleLabel = selectedModule ? selectedModule.name : "All modules";
  const printable = items.filter((item) => {
    const moduleOk = moduleId === "all" || item.moduleId === moduleId;
    const categoryOk = categoryMatches(item, category);
    return item.status === "IN_PROGRESS" && includesOrigin(origin, item) && moduleOk && categoryOk && matchesQuery(item, normalizedQuery);
  });
  const printableGroups = [];
  printable.forEach((item) => {
    let group = printableGroups.find((entry) => entry.moduleId === item.moduleId);
    if (!group) {
      group = {
        moduleId: item.moduleId,
        moduleName: item.moduleName,
        items: [],
      };
      printableGroups.push(group);
    }
    group.items.push(item);
  });

  async function exportPdf() {
    if (printable.length === 0) return;
    setExporting(true);
    setError("");
    try {
      await exportFeedbackPdf({
        groups: printableGroups,
        moduleLabel,
        typeLabel: origin === "DASHBOARD" ? typeLabel : `${collection.label} · ${typeLabel}`,
        search: query.trim(),
      });
    } catch (exportError) {
      setError(exportError.message || "The PDF could not be created.");
    } finally {
      setExporting(false);
    }
  }

  function handleCreated(created) {
    if (created.kind === "module") {
      setModules((current) => [...current, created.module].sort((a, b) => a.name.localeCompare(b.name)));
      setModuleId(created.module.id);
      return;
    }
    setItems((current) => [...current, created.item]);
    setOrigin(created.item.departmentId);
    setModuleId(created.item.moduleId);
    setCategory(created.item.category);
    setStatus(created.item.status);
    setOpenMenus((current) => ({ ...current, [created.item.departmentId]: true }));
    setManageView(null);
    setDialogOpen(false);
  }

  async function confirmDelete(pin) {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "module") {
      await deleteModule(pendingDelete.module.id, pin);
      setModules((current) => current.filter((module) => module.id !== pendingDelete.module.id));
      setItems((current) => current.filter((item) => item.moduleId !== pendingDelete.module.id));
      if (moduleId === pendingDelete.module.id) setModuleId("all");
      return;
    }
    await deleteFeedback(pendingDelete.item.id, pin);
    setItems((current) => current.filter((item) => item.id !== pendingDelete.item.id));
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Smart V2 Review</h1>
          <p>Feedback by department</p>
        </div>
        <p className="menu-label">Views</p>
        <nav className="menu" aria-label="Feedback views">
          <button
            type="button"
            className={origin === "DASHBOARD" && !manageView ? "active" : ""}
            onClick={() => { setManageView(null); setOrigin("DASHBOARD"); setModuleId("all"); }}
          >
            <span className="menu-name"><span>Dashboard</span></span>
            <span className="count">{areaCounts.DASHBOARD || 0}</span>
          </button>
        </nav>
        <p className="menu-label">Departments</p>
        <nav className="menu" aria-label="Departments">
          {departments.map((department) => {
            const open = Boolean(openMenus[department.id]);
            return (
              <div className="menu-group" key={department.id}>
                <button
                  type="button"
                  className={`menu-parent${origin === department.id && !manageView ? " active" : ""}`}
                  aria-expanded={open}
                  onClick={() => setOpenMenus((current) => ({ ...current, [department.id]: !current[department.id] }))}
                >
                  <span className="menu-name">
                    <ModuleMark name={department.icon} />
                    <span>{department.name}</span>
                  </span>
                  <ChevronDown className={`chevron${open ? " open" : ""}`} size={18} aria-hidden="true" />
                </button>
                {open && (
                  <div className="menu-children">
                    <button
                      type="button"
                      className={origin === department.id && moduleId === "all" && !manageView ? "active" : ""}
                      onClick={() => { setManageView(null); setOrigin(department.id); setModuleId("all"); }}
                    >
                      <span className="menu-name"><span>All</span></span>
                      <span className="count">
                        {Object.values(moduleCounts[department.id] || {}).reduce((sum, value) => sum + value, 0)}
                      </span>
                    </button>
                    {modules.length === 0 && <p className="menu-empty">No modules yet</p>}
                    {modules.map((module) => (
                      <button
                        type="button"
                        className={origin === department.id && moduleId === module.id && !manageView ? "active" : ""}
                        key={module.id}
                        onClick={() => { setManageView(null); setOrigin(department.id); setModuleId(module.id); }}
                      >
                        <span className="menu-name">
                          <ModuleMark name={module.icon} />
                          <span>{module.name}</span>
                        </span>
                        <span className="count">{moduleCounts[department.id]?.[module.id] || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {canManage && (
          <button type="button" className={`manage-action${manageView ? " active" : ""}`} onClick={() => setManageView("home")}>
            <Settings size={18} aria-hidden="true" />
            Manage
          </button>
        )}
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <h2>{manageTitle(manageView, collection.title)}</h2>
            <p>{manageDescription(manageView, collection.description)}</p>
          </div>
          <div className="header-actions">
            {canRegister && !manageView && (
              <button type="button" className="primary" onClick={() => setDialogOpen(true)}>
                Register feedback
              </button>
            )}
            <ProfileMenu user={user} onProfile={() => setProfileOpen(true)} onSignOut={onSignOut} />
          </div>
        </header>

        {manageView ? (
          <ManagePanel
            view={manageView}
            currentUsername={user.username}
            canManageUsers={canManageUsers}
            canDelete={canDelete}
            modules={modules}
            onUsers={() => setManageView("users")}
            onDepartments={() => setManageView("departments")}
            onModules={() => setManageView("modules")}
            onHome={() => setManageView("home")}
            onNetworks={() => setNetworksOpen(true)}
            onSecurity={() => setSecurityOpen(true)}
            onSignOut={onSignOut}
            onModulesChanged={(module) => setModules((current) => [...current, module].sort((a, b) => a.name.localeCompare(b.name)))}
            onDepartmentsChanged={setDepartments}
            onEditModule={setEditingModule}
            onDeleteModule={(module) => setPendingDelete({ kind: "module", module })}
          />
        ) : (
        <>

        <section className="status-board" aria-label="Issue status">
          {STATUSES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`status-card ${entry.id} ${status === entry.id ? "active" : ""}`}
              onClick={() => setStatus((current) => (current === entry.id ? "all" : entry.id))}
            >
              <strong>{statusCounts[entry.id] || 0}</strong>
              <span>{entry.label}</span>
            </button>
          ))}
        </section>

        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search titles or details"
            aria-label="Search feedback"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="filters" role="group" aria-label="Category filter">
            <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>
              All feedback
              <span className="count">{categoryCounts.all || 0}</span>
            </button>
            {CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={category === entry.id ? "active" : ""}
                onClick={() => setCategory(entry.id)}
              >
                <span className={`dot ${entry.dot}`} />
                {entry.label}
                <span className="count">{categoryCounts[entry.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="result-bar">
          <span>
            {summary === "Showing all feedback"
              ? <>Showing <strong>all feedback</strong></>
              : summary === `Showing ${collection.label}`
                ? <>Showing <strong>{collection.label}</strong></>
                : summary}
          </span>
          <span className="result-actions">
            <span>{visible.length} {visible.length === 1 ? "item" : "items"}</span>
            <button type="button" className="ghost" onClick={exportPdf} disabled={exporting || printable.length === 0}>
              {exporting ? "Preparing PDF…" : "Export PDF"}
            </button>
          </span>
        </div>

        {error && <div className="banner" role="alert">{error}</div>}
        {loading && <div className="loading">Loading feedback…</div>}

        {!loading && groups.map((group) => {
          const moduleRecord = modules.find((module) => module.id === group.moduleId);
          return (
          <section className="section-card" key={group.moduleId}>
            {!group.flat && (
            <div className="section-heading">
              <h3><ModuleMark name={group.moduleIcon} /> {group.moduleName}</h3>
              {moduleRecord?.createdByName && <p className="module-creator">Created by {moduleRecord.createdByName}</p>}
            </div>
            )}
            <div className="items">
              {group.items.map((item) => {
                const categoryMeta = categoryById(item.category);
                return (
                  <article className={`item ${item.status}`} key={item.id}>
                    <div className="item-top">
                      <span className="item-meta">
                        <span className="item-meta-line">
                          <span className="index">{String(item.itemNumber).padStart(2, "0")}</span>
                          <span className="created">
                            Created {formatCreated(item.createdAt)}
                            {item.createdByName ? ` by ${item.createdByName}` : ""}
                          </span>
                        </span>
                        {(origin === "DASHBOARD") && item.moduleName && (
                          <span className="created">{item.moduleName}</span>
                        )}
                        {item.updatedByName && <span className="created">Updated by {item.updatedByName}</span>}
                        {item.statusChangedByName && (
                          <span className="created">
                            {STATUSES.find((entry) => entry.id === item.status)?.label} by {item.statusChangedByName}
                          </span>
                        )}
                      </span>
                      <span className="item-tags">
                        {((item.screenshots?.length || 0) > 0 || item.hasScreenshot) && (
                          <button type="button" className="view-shot" onClick={() => setViewing(item)}>
                            View Screenshot
                          </button>
                        )}
                        {origin === "DASHBOARD" && (
                          <span className="tag inquiry">{item.departmentName}</span>
                        )}
                        <span className={`tag ${categoryMeta?.dot || ""}`}>{categoryMeta?.label}</span>
                      </span>
                    </div>
                    <p>
                      <span className="highlight">{item.title}:</span> {item.details}
                    </p>
                    <div className="item-actions">
                      <div className="status-switch" role="group" aria-label={`Status for ${item.title}`}>
                        {STATUSES.map((entry) => (
        <button
                            key={entry.id}
          type="button"
                            className={`${entry.id} ${item.status === entry.id ? "active" : ""}`}
                            disabled={!canChangeStatus || pendingId === item.id}
                            onClick={() => changeStatus(item, entry.id)}
        >
                            {entry.label}
        </button>
                        ))}
                      </div>
                      <ItemActions
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={() => setEditing(item)}
                        onDelete={() => setPendingDelete({ kind: "feedback", item })}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
      </section>
          );
        })}

        {!loading && visible.length === 0 && (
          <div className="empty">No feedback matches this view. Clear a filter or register a new item.</div>
        )}
        </>
        )}

        <footer>Smart-Remit V2 Engineering & Product Feedback Report</footer>
      </main>

      {dialogOpen && (
        <RegisterDialog
          modules={modules}
          departments={departments}
          canChooseDepartment={canCreateModule}
          initialModuleId={moduleId === "all" ? modules[0]?.id ?? "" : moduleId}
          initialDepartmentId={origin === "DASHBOARD" ? user.departmentId : origin}
          allowStatus={canChangeStatus}
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {profileOpen && (
        <ProfileDialog
          user={user}
          onClose={() => setProfileOpen(false)}
          onUpdated={(next) => {
            onUserUpdated(next);
            setProfileOpen(false);
          }}
        />
      )}
      {securityOpen && <SecurityLogDialog onClose={() => setSecurityOpen(false)} />}
      {networksOpen && <AllowedNetworksDialog onClose={() => setNetworksOpen(false)} />}
      {editingModule && (
        <EditModuleDialog
          module={editingModule}
          onClose={() => setEditingModule(null)}
          onSaved={(updated) => {
            setModules((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)).sort((a, b) => a.name.localeCompare(b.name)));
            setItems((current) => current.map((item) => (
              item.moduleId === updated.id
                ? { ...item, moduleName: updated.name, moduleIcon: updated.icon }
                : item
            )));
            setEditingModule(null);
          }}
        />
      )}
      {editing && (
        <EditDialog
          item={editing}
          modules={modules}
          departments={departments}
          canChooseDepartment={canCreateModule}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
            setEditing(null);
          }}
        />
      )}
      {viewing && <ScreenshotBrowser item={viewing} onClose={() => setViewing(null)} />}
      {pendingDelete && (
        <PinConfirmDialog
          title={pendingDelete.kind === "module" ? `Delete ${pendingDelete.module.name}` : `Delete ${pendingDelete.item.title}`}
          message={pendingDelete.kind === "module"
            ? "Enter your PIN to delete this module. Feedback in the module is deleted with it."
            : "Enter your PIN to delete this feedback."}
          onClose={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
        </div>
  );
}

function includesOrigin(selected, item) {
  if (selected === "DASHBOARD") return true;
  return item.departmentId === selected;
}

function ModuleActions({ name, canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className={`item-menu${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="item-menu-button"
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dots" aria-hidden="true" />
      </button>
      {open && (
        <div className="item-menu-list" role="menu">
          {canEdit && (
            <button type="button" role="menuitem" onClick={() => choose(onEdit)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-3L16.5 4.5a2 2 0 0 0-3 0L3 15v5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              Edit
            </button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" className="menu-danger" onClick={() => choose(onDelete)}>
              <svg className="delete-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemActions({ item, canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className={`item-menu${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="item-menu-button"
        aria-label={`Actions for ${item.title}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dots" aria-hidden="true" />
      </button>
      {open && (
        <div className="item-menu-list" role="menu">
          {canEdit && <button type="button" role="menuitem" onClick={() => choose(onEdit)}>Edit</button>}
          {canDelete && (
            <button type="button" role="menuitem" className="menu-danger" onClick={() => choose(onDelete)}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

function RegisterDialog({ modules, departments, canChooseDepartment, initialModuleId, initialDepartmentId, allowStatus = true, onClose, onCreated }) {
  const [feedbackForm, setFeedbackForm] = useState({
    ...emptyFeedbackForm,
    moduleId: initialModuleId === "" ? "" : String(initialModuleId),
    departmentId: initialDepartmentId ? String(initialDepartmentId) : "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(() => [newShotRow()]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedbackForm.moduleId) {
      setFormError("Choose a module before adding feedback.");
      return;
    }
    if (canChooseDepartment && !feedbackForm.departmentId) {
      setFormError("Choose a department.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const screenshots = await readScreenshots(rows);
      const item = await createFeedback({
        moduleId: Number(feedbackForm.moduleId),
        title: feedbackForm.title.trim(),
        details: feedbackForm.details.trim(),
        category: feedbackForm.category,
        status: allowStatus ? feedbackForm.status : "IN_PROGRESS",
        departmentId: canChooseDepartment ? Number(feedbackForm.departmentId) : Number(initialDepartmentId),
        operationsTopic: null,
        screenshots,
      });
      onCreated({ kind: "feedback", item });
    } catch (submitError) {
      setFormError(submitError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="register-title">
        <h3 id="register-title">Register feedback</h3>
        <p>{canChooseDepartment ? "Choose the department this feedback belongs to, then record it against a module." : "Record feedback against a module. It is filed under your department."}</p>
        {formError && <p className="form-error">{formError}</p>}
        {modules.length === 0 && <p className="form-error">An admin needs to create a module in Manage before feedback can be registered.</p>}
          <form onSubmit={submitFeedback}>
            {canChooseDepartment && (
              <div className="field">
                <label htmlFor="feedback-department">Department</label>
                <select
                  id="feedback-department"
                  required
                  value={feedbackForm.departmentId}
                  onChange={(event) => setFeedbackForm({ ...feedbackForm, departmentId: event.target.value })}
                >
                  <option value="">Select a department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="feedback-module">Module</label>
              <select
                id="feedback-module"
                required
                value={feedbackForm.moduleId}
                onChange={(event) => setFeedbackForm({ ...feedbackForm, moduleId: event.target.value })}
              >
                <option value="">Select a module</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>{module.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="feedback-type">Feedback type</label>
              <select
                id="feedback-type"
                required
                value={feedbackForm.category}
                onChange={(event) => setFeedbackForm({ ...feedbackForm, category: event.target.value })}
              >
                {CATEGORIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="feedback-title">Title</label>
              <input
                id="feedback-title"
                required
                maxLength={200}
                value={feedbackForm.title}
                onChange={(event) => setFeedbackForm({ ...feedbackForm, title: event.target.value })}
                placeholder="Short name for the issue"
              />
            </div>
            <div className="field">
              <label htmlFor="feedback-details">Details</label>
              <textarea
                id="feedback-details"
                required
                value={feedbackForm.details}
                onChange={(event) => setFeedbackForm({ ...feedbackForm, details: event.target.value })}
                placeholder="Describe the expected behavior"
              />
            </div>
            {allowStatus && (
              <div className="field">
                <label htmlFor="feedback-status">Status</label>
                <select
                  id="feedback-status"
                  value={feedbackForm.status}
                  onChange={(event) => setFeedbackForm({ ...feedbackForm, status: event.target.value })}
                >
                  {STATUSES.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
                <p className="field-hint">New feedback starts as In progress. Choose Expected feature only when developers confirm the behavior is intended, so it is not a bug.</p>
              </div>
            )}
            <ScreenshotEditor rows={rows} setRows={setRows} />
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary" disabled={saving || modules.length === 0}>
                {saving ? "Saving…" : "Save feedback"}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

const SCREENSHOT_NAMES = ["New System Screenshot", "Legacy System Screenshot"];

function newShotRow() {
  return { key: `${Date.now()}-${Math.random()}`, label: "", file: null };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const splitAt = result.indexOf(",");
      resolve(splitAt >= 0 ? result.slice(splitAt + 1) : result);
    };
    reader.onerror = () => reject(new Error("The screenshot could not be read."));
    reader.readAsDataURL(file);
  });
}

async function readScreenshots(rows) {
  const uploads = [];
  for (const row of rows) {
    if (!row.file && !row.label) continue;
    if (!SCREENSHOT_NAMES.includes(row.label)) {
      throw new Error("Choose New System Screenshot or Legacy System Screenshot.");
    }
    if (!row.file) {
      throw new Error("Choose an image for each screenshot.");
    }
    if (!row.file.type.startsWith("image/")) {
      throw new Error("Attach an image file.");
    }
    if (row.file.size > 4 * 1024 * 1024) {
      throw new Error("Choose an image that is 4 MB or smaller.");
    }
    uploads.push({
      label: row.label,
      fileName: row.file.name,
      contentType: row.file.type,
      data: await readFileAsBase64(row.file),
    });
  }
  return uploads;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [blockedIp, setBlockedIp] = useState("");

  useEffect(() => {
    function onDenied(event) {
      setBlockedIp(event.detail?.ipAddress || "Unknown");
    }
    window.addEventListener("ip-denied", onDenied);
    return () => window.removeEventListener("ip-denied", onDenied);
  }, []);

  useEffect(() => {
    checkAccess()
      .catch((error) => {
        if (error.code === "IP_NOT_ALLOWED") setBlockedIp(error.ipAddress || "Unknown");
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const saved = readSession();
    if (!saved) return;
    writeSession(saved);
    fetchMe()
      .then((user) => setSession({ token: saved.token, user }))
      .catch((error) => {
        if (error.code !== "IP_NOT_ALLOWED") clearSession();
      });
  }, []);

  async function signOut() {
    try {
      await logout();
    } catch {
      // The session is already gone.
    }
    clearSession();
    setSession(null);
  }

  if (!ready) {
    return <div className="auth-screen"><div className="loading">Loading…</div></div>;
  }
  if (blockedIp) {
    return <AccessDenied ip={blockedIp} />;
  }
  if (!session) {
    return <LoginPage onSuccess={setSession} />;
  }
  if (session.user.mustChangePin) {
    return (
      <PinResetPage
        user={session.user}
        onUpdated={(user) => setSession({ ...session, user })}
        onSignOut={signOut}
      />
    );
  }
  return <Dashboard user={session.user} onSignOut={signOut} onUserUpdated={(nextUser) => {
    const next = { token: session.token, user: nextUser };
    writeSession(next);
    setSession(next);
  }} />;
}

function AccessDenied({ ip }) {
  const [copied, setCopied] = useState(false);

  async function copyIp() {
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-card denied-card">
        <h1>Network Access Denied</h1>
        <p>
          Network Access Denied. This system is restricted to authorized locations only.
          Your current detected IP address is: <strong className="detected-ip">{ip}</strong>.
          Please copy this IP address and send it to your System Administrator to request access.
        </p>
        <button type="button" className="primary" onClick={copyIp}>{copied ? "Copied" : "Copy IP address"}</button>
      </section>
    </div>
  );
}

function AllowedNetworksDialog({ onClose }) {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: "", ipAddress: "", description: "" });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pending) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  useEffect(() => {
    Promise.all([fetchAllowedIps(), fetchUsers()])
      .then(([addresses, accounts]) => {
        setRows(addresses);
        setUsers(accounts);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createAllowedIp({
        userId: form.userId ? Number(form.userId) : null,
        ipAddress: form.ipAddress.trim(),
        description: form.description.trim(),
      });
      setRows(await fetchAllowedIps());
      setForm({ userId: "", ipAddress: "", description: "" });
      setNotice("The address is allowed.");
      setSaving(false);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="network-title" onSubmit={submit}>
        <h3 id="network-title">Allowed networks</h3>
        <p>Add the public IP address a user sends you when they change location. Leave the user as “Any user” when the address is an office used by more than one person.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-note" role="status">{notice}</p>}
        <div className="field">
          <label htmlFor="network-user">User</label>
          <select id="network-user" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}>
            <option value="">Any user at this location</option>
            {users.map((account) => (
              <option key={account.id} value={account.id}>{account.fullName} ({account.username})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="network-ip">IP address</label>
          <input
            id="network-ip"
            required
            maxLength={64}
            value={form.ipAddress}
            placeholder="203.0.113.10"
            onChange={(event) => setForm({ ...form, ipAddress: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="network-description">Description</label>
          <input
            id="network-description"
            required
            maxLength={80}
            value={form.description}
            placeholder="Office"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
          <button type="submit" className="primary" disabled={saving || form.ipAddress.trim().length === 0 || form.description.trim().length === 0}>
            {saving ? "Saving…" : "Allow this IP"}
          </button>
        </div>
        <div className="user-list">
          {rows.map((row) => (
            <div className="user-row" key={row.id}>
              <span>
                <strong>{row.ipAddress}</strong>
                <span>{row.description} · {row.username}</span>
              </span>
              <button type="button" className="danger" onClick={() => setPending(row)}>Remove</button>
            </div>
          ))}
        </div>
      </form>
      {pending && (
        <PinConfirmDialog
          title={`Remove ${pending.ipAddress}`}
          message="Enter your PIN to remove this address. Browsers at that location will be denied."
          onClose={() => setPending(null)}
          onConfirm={async (pin) => {
            await deleteAllowedIp(pending.id, pin);
            setRows((current) => current.filter((row) => row.id !== pending.id));
          }}
        />
      )}
    </div>
  );
}

function LoginPage({ onSuccess }) {
  const [step, setStep] = useState("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deviceReady, setDeviceReady] = useState(() => readDeviceToken().length > 0);
  const deviceFileRef = useRef(null);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await login(username.trim(), pin);
      writeSession(result);
      onSuccess(result);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSaving(false);
    }
  }

  async function startForgot() {
    if (!username.trim()) {
      setError("Enter your username first.");
      setNotice("");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await requestOtp(username.trim());
      setOtp("");
      setNotice("");
      setStep("otp");
    } catch (forgotError) {
      setError(forgotError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitOtp(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await verifyOtp(username.trim(), otp.trim());
      setResetToken(result.resetToken);
      setNewPin("");
      setConfirmPin("");
      setNotice("");
      setStep("reset");
    } catch (otpError) {
      setError(otpError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await resetPinWithOtp(resetToken, newPin, confirmPin);
      setPin("");
      setOtp("");
      setResetToken("");
      setNewPin("");
      setConfirmPin("");
      setStep("login");
      setNotice("Your PIN was updated. Sign in with the new PIN.");
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setSaving(false);
    }
  }

  function backToLogin() {
    setStep("login");
    setError("");
    setNotice("");
    setOtp("");
    setResetToken("");
  }

  async function importDeviceFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.product !== "smart-v2-device-key" || typeof parsed.deviceToken !== "string" || parsed.deviceToken.trim().length < 20) {
        throw new Error("This file is not a device key.");
      }
      writeDeviceToken(parsed.deviceToken.trim());
      setDeviceReady(true);
      setNotice(parsed.deviceName ? `Device key imported for ${parsed.deviceName}.` : "Device key imported.");
    } catch (importError) {
      setError(importError.message || "This file is not a device key.");
    }
  }

  return (
    <div className="auth-screen">
      {step === "login" && (
        <form className="auth-card" onSubmit={submit}>
          <h1>Smart V2 Review</h1>
          <p>Sign in with your username and PIN from a browser that has its device key.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-note">{notice}</p>}
          <p className={deviceReady ? "form-note" : "form-error"}>
            {deviceReady ? "Device key is installed on this browser." : "No device key is installed on this browser."}
          </p>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              value={pin}
              onChange={(event) => setPin(digitsOnly(event.target.value))}
            />
          </div>
          <button type="submit" className="primary" disabled={saving || pin.length === 0}>
            {saving ? "Signing in…" : "Sign in"}
          </button>
          <button type="button" className="text-link" onClick={startForgot} disabled={saving}>
            Forgot PIN
          </button>
          <input
            ref={deviceFileRef}
            className="hidden-file"
            type="file"
            accept="application/json,.json"
            onChange={importDeviceFile}
          />
          <button type="button" className="text-link" onClick={() => deviceFileRef.current?.click()}>
            Import device key
          </button>
          {deviceReady && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                clearDeviceToken();
                setDeviceReady(false);
                setNotice("Device key removed from this browser.");
              }}
            >
              Remove device key
            </button>
          )}
          <p className="field-hint">A browser cannot read a computer serial number. Ask an admin to register this browser and send you the device key file. Import that file once, then sign in.</p>
        </form>
      )}

      {step === "otp" && (
        <form className="auth-card" onSubmit={submitOtp}>
          <h1>Enter the OTP</h1>
          <p>An OTP was created for {username.trim()}. Enter it below.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="otp">OTP</label>
            <input
              id="otp"
              className="pin-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(event) => setOtp(digitsOnly(event.target.value))}
            />
          </div>
          <button type="submit" className="primary" disabled={saving || otp.length === 0}>
            {saving ? "Checking…" : "Continue"}
          </button>
          <button type="button" className="text-link" onClick={backToLogin}>Back to sign in</button>
        </form>
      )}

      {step === "reset" && (
        <form className="auth-card" onSubmit={submitReset}>
          <h1>Reset PIN</h1>
          <p>Choose a new PIN for {username.trim()}.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="forgot-new-pin">New PIN</label>
            <input
              id="forgot-new-pin"
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required
              value={newPin}
              onChange={(event) => setNewPin(digitsOnly(event.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="forgot-confirm-pin">Confirm new PIN</label>
            <input
              id="forgot-confirm-pin"
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required
              value={confirmPin}
              onChange={(event) => setConfirmPin(digitsOnly(event.target.value))}
            />
          </div>
          <button type="submit" className="primary" disabled={saving || newPin.length === 0 || confirmPin.length === 0}>
            {saving ? "Saving…" : "Save PIN"}
          </button>
          <button type="button" className="text-link" onClick={backToLogin}>Back to sign in</button>
        </form>
      )}
    </div>
  );
}

function PinResetPage({ user, onUpdated, onSignOut }) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await changePin(newPin, confirmPin);
      const saved = readSession();
      writeSession({ ...saved, user: updated });
      onUpdated(updated);
    } catch (pinError) {
      setError(pinError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Choose a new PIN</h1>
        <p>{user.fullName}, the default PIN can only be used once. Enter a new PIN to continue.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="new-pin">New PIN</label>
          <input
            id="new-pin"
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            value={newPin}
            onChange={(event) => setNewPin(digitsOnly(event.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-pin">Confirm new PIN</label>
          <input
            id="confirm-pin"
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            value={confirmPin}
            onChange={(event) => setConfirmPin(digitsOnly(event.target.value))}
          />
        </div>
        <button type="submit" className="primary" disabled={saving || newPin.length === 0 || confirmPin.length === 0}>
          {saving ? "Saving…" : "Save PIN"}
        </button>
        <button type="button" className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={onSignOut}>
          Sign out
        </button>
      </form>
    </div>
  );
}

function EditModuleDialog({ module, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: module.name,
    description: module.description || "",
    icon: module.icon || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateModule(module.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "The module could not be updated.");
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="dialog-head">
          <div>
            <h2>Edit module</h2>
            <p>Update the name, icon, and description.</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="edit-module-name">Module name</label>
          <input
            id="edit-module-name"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div className="field">
          <label>Icon</label>
          <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        </div>
        <div className="field">
          <label htmlFor="edit-module-description">Description</label>
          <textarea
            id="edit-module-description"
            maxLength={400}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>
        <button type="submit" className="primary" disabled={saving || form.name.trim().length === 0}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function EditDialog({ item, modules, departments, canChooseDepartment, onClose, onSaved }) {
  const [form, setForm] = useState({
    moduleId: String(item.moduleId),
    departmentId: item.departmentId ? String(item.departmentId) : "",
    category: item.category,
    title: item.title,
    details: item.details,
    status: item.status,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(() => ((item.screenshots?.length || 0) > 0 ? [] : [newShotRow()]));
  const [removeIds, setRemoveIds] = useState([]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const screenshots = await readScreenshots(rows);
      const updated = await updateFeedback(item.id, {
        moduleId: Number(form.moduleId),
        departmentId: canChooseDepartment ? Number(form.departmentId) : item.departmentId,
        operationsTopic: null,
        category: form.category,
        title: form.title.trim(),
        details: form.details.trim(),
        status: form.status,
        screenshots,
        removeScreenshotIds: removeIds,
      });
      onSaved(updated);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={submit}>
        <h3 id="edit-title">Edit feedback</h3>
        <p>Update the record. The original author stays as the person who created it.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {canChooseDepartment ? (
          <div className="field">
            <label htmlFor="edit-department">Department</label>
            <select id="edit-department" required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
        ) : (
          <p className="form-note">Reported by {item.departmentName}</p>
        )}
        <div className="field">
          <label htmlFor="edit-module">Module</label>
          <select id="edit-module" required value={form.moduleId} onChange={(event) => setForm({ ...form, moduleId: event.target.value })}>
            {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit-type">Feedback type</label>
          <select id="edit-type" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {form.category === "INQUIRY" && <option value="INQUIRY">Inquiry</option>}
            {CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit-title">Title</label>
          <input id="edit-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="edit-details">Details</label>
          <textarea id="edit-details" required value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="edit-status">Status</label>
          <select id="edit-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {STATUSES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>
        <ScreenshotEditor
          feedbackId={item.id}
          rows={rows}
          setRows={setRows}
          existing={item.screenshots || []}
          removeIds={removeIds}
          setRemoveIds={setRemoveIds}
        />
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

function ProfileMenu({ user, onProfile, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="profile-menu" ref={rootRef}>
      <button type="button" className="avatar-button" aria-label={`Profile for ${user.fullName}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {initials(user.fullName)}
      </button>
      {open && (
        <div className="profile-popover">
          <strong>{user.fullName}</strong>
          <span>{user.username}</span>
          <span>{roleLabel(user.role)} · {user.departmentName}</span>
          <button type="button" onClick={() => { setOpen(false); onProfile(); }}>Manage profile</button>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function ProfileDialog({ user, onClose, onUpdated }) {
  const [fullName, setFullName] = useState(user.fullName || "");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let next = await updateProfile(fullName.trim());
      if (newPin || confirmPin) {
        next = await changePin(newPin, confirmPin);
      }
      onUpdated(next);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" onSubmit={submit}>
        <h3 id="profile-title">Your profile</h3>
        <p>Update your name. Role and department are set by the account manager.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="profile-name">Full name</label>
          <input id="profile-name" required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="profile-username">Username</label>
          <input id="profile-username" value={user.username} readOnly />
        </div>
        <div className="field">
          <label htmlFor="profile-role">Role</label>
          <input id="profile-role" value={roleLabel(user.role)} readOnly />
        </div>
        <div className="field">
          <label htmlFor="profile-department">Department</label>
          <input id="profile-department" value={user.departmentName || ""} readOnly />
        </div>
        <div className="field">
          <label htmlFor="profile-pin">New PIN</label>
          <input id="profile-pin" type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(event.target.value)} placeholder="Leave blank to keep the current PIN" />
        </div>
        <div className="field">
          <label htmlFor="profile-pin-confirm">Confirm new PIN</label>
          <input id="profile-pin-confirm" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        </div>
      </form>
    </div>
  );
}

function ManagePanel({
  view,
  currentUsername,
  canManageUsers,
  canDelete,
  modules,
  onUsers,
  onDepartments,
  onModules,
  onHome,
  onNetworks,
  onSecurity,
  onSignOut,
  onEditModule,
  onDeleteModule,
  onModulesChanged,
  onDepartmentsChanged,
}) {
  if (view === "users") return <UsersPage currentUsername={currentUsername} onBack={onHome} />;
  if (view === "departments") return <DepartmentsPage onBack={onHome} onChanged={onDepartmentsChanged} />;
  if (view === "modules") {
    return (
      <ModulesPage
        modules={modules}
        canDelete={canDelete}
        onBack={onHome}
        onEdit={onEditModule}
        onDelete={onDeleteModule}
        onCreated={onModulesChanged}
      />
    );
  }
  return (
    <section className="manage-screen" aria-label="Manage">
      <div className="manage-list">
        {canManageUsers && (
          <button type="button" onClick={onNetworks}><Globe size={18} aria-hidden="true" /> Allowed networks</button>
        )}
        {canManageUsers && (
          <button type="button" onClick={onUsers}><Users size={18} aria-hidden="true" /> Users</button>
        )}
        <button type="button" onClick={onDepartments}><Building2 size={18} aria-hidden="true" /> Departments</button>
        <button type="button" onClick={onModules}><Layers size={18} aria-hidden="true" /> Modules</button>
        {canManageUsers && (
          <button type="button" onClick={onSecurity}><Shield size={18} aria-hidden="true" /> Security log</button>
        )}
        <button type="button" className="manage-signout" onClick={onSignOut}><LogOut size={18} aria-hidden="true" /> Sign out</button>
      </div>
    </section>
  );
}

function DepartmentsPage({ onBack, onChanged }) {
  const [departments, setDepartments] = useState([]);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch((loadError) => setError(loadError.message));
  }, []);

  async function refresh(next) {
    setDepartments(next);
    if (onChanged) onChanged(next);
  }

  return (
    <section className="manage-screen">
      <div className="page-toolbar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <button type="button" className="primary" onClick={() => setEditor({ name: "", icon: "building-2" })}>Add department</button>
      </div>
      {error && <div className="banner" role="alert">{error}</div>}
      <div className="user-list page-list">
        {departments.map((department) => (
          <div className="user-row" key={department.id}>
            <span>
              <strong><ModuleMark name={department.icon} /> {department.name}</strong>
            </span>
            <UserActions
              name={department.name}
              canDelete
              onEdit={() => setEditor(department)}
              onDevice={null}
              onDelete={async () => {
                try {
                  await deleteDepartment(department.id);
                  const next = await fetchDepartments();
                  await refresh(next);
                } catch (deleteError) {
                  setError(deleteError.message);
                }
              }}
            />
          </div>
        ))}
      </div>
      {editor && (
        <DepartmentDialog
          department={editor.id ? editor : null}
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            const next = await fetchDepartments();
            await refresh(next);
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}

function DepartmentDialog({ department, initial, onClose, onSaved }) {
  const [form, setForm] = useState({ name: initial?.name || "", icon: initial?.icon || "building-2" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    if (!form.icon) {
      setError("Choose an icon.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.name.trim(), icon: form.icon };
      if (department) await updateDepartment(department.id, payload);
      else await createDepartment(payload);
      await onSaved();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="department-title" onSubmit={submit}>
        <h3 id="department-title">{department ? "Edit department" : "Add department"}</h3>
        <p>The name appears in the sidebar. Choose an icon so the menu is easy to scan.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="department-name">Name</label>
          <input id="department-name" required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="field">
          <label>Icon</label>
          <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save department"}</button>
        </div>
      </form>
    </div>
  );
}

function ModulesPage({ modules, canDelete, onBack, onEdit, onDelete, onCreated }) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="manage-screen">
      <div className="page-toolbar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <button type="button" className="primary" onClick={() => setAdding(true)}>Add module</button>
      </div>
      <div className="user-list page-list">
        {modules.map((module) => (
          <div className="user-row" key={module.id}>
            <span>
              <strong><ModuleMark name={module.icon} /> {module.name}</strong>
              {module.createdByName && <span>Created by {module.createdByName}</span>}
            </span>
            <UserActions
              name={module.name}
              canDelete={canDelete}
              onEdit={() => onEdit(module)}
              onDelete={() => onDelete(module)}
            />
          </div>
        ))}
      </div>
      {adding && (
        <ModuleCreateDialog
          onClose={() => setAdding(false)}
          onCreated={(module) => {
            onCreated(module);
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

function ModuleCreateDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyModuleForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const module = await createModule({
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
      });
      onCreated(module);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-module-title" onSubmit={submit}>
        <h3 id="create-module-title">Add module</h3>
        <p>Modules are shared by every department. Feedback is filed under the department chosen when it is registered.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="create-module-name">Module name</label>
          <input id="create-module-name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Agent Creation" />
        </div>
        <div className="field">
          <label>Icon</label>
          <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        </div>
        <div className="field">
          <label htmlFor="create-module-description">Description</label>
          <textarea id="create-module-description" maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this module covers" />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save module"}</button>
        </div>
      </form>
    </div>
  );
}

function UserActions({ name, canDelete, onEdit, onDevice, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    <div className={`item-menu${open ? " open" : ""}`} ref={rootRef}>
      <button type="button" className="item-menu-button" aria-label={`Actions for ${name}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="dots" aria-hidden="true" />
      </button>
      {open && (
        <div className="item-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={() => choose(onEdit)}>Edit</button>
          {onDevice && (
            <button type="button" role="menuitem" onClick={() => choose(onDevice)}>Registered device</button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" className="menu-danger" onClick={() => choose(onDelete)}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

function UsersPage({ currentUsername, onBack }) {
  const [users, setUsers] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [deviceUser, setDeviceUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <section className="manage-screen">
      <div className="page-toolbar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <button type="button" className="primary" onClick={() => setAddOpen(true)}>Add user</button>
      </div>
      {error && <div className="banner" role="alert">{error}</div>}
      <div className="user-list page-list">
        {users.map((account) => (
          <div className="user-row" key={account.id}>
            <span>
              <strong>{account.fullName}</strong>
              <span>{account.username} · {roleLabel(account.role)} · {account.departmentName}</span>
            </span>
            <UserActions
              name={account.fullName}
              canDelete={account.username !== "bulxan"}
              onEdit={() => setEditingUser(account)}
              onDevice={() => setDeviceUser(account)}
              onDelete={() => setPendingUser(account)}
            />
          </div>
        ))}
      </div>
      {addOpen && (
        <AddUserDialog
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setUsers(await fetchUsers());
            setAddOpen(false);
          }}
        />
      )}
      {editingUser && (
        <EditUserDialog
          account={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setUsers((current) => current.map((account) => (account.id === updated.id ? updated : account)));
            setEditingUser(null);
          }}
        />
      )}
      {pendingUser && (
        <PinConfirmDialog
          title={`Delete ${pendingUser.fullName}`}
          message="Enter your PIN to delete this user. They will no longer be able to sign in."
          onClose={() => setPendingUser(null)}
          onConfirm={async (pin) => {
            await deleteUser(pendingUser.id, pin);
            setUsers((current) => current.filter((account) => account.id !== pendingUser.id));
          }}
        />
      )}
      {deviceUser && (
        <DeviceDialog
          account={deviceUser}
          currentUsername={currentUsername}
          onClose={() => setDeviceUser(null)}
        />
      )}
    </section>
  );
}

function AddUserDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: "", username: "", role: "REPORTER", departmentId: "" });
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    if (!form.departmentId) {
      setError("Choose a department.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createUser({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        role: form.role,
        departmentId: Number(form.departmentId),
      });
      await onCreated();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="user-title" onSubmit={submit}>
        <h3 id="user-title">Add user</h3>
        <p>Create an account. Role and department are required. The first PIN is 123456, and they must choose a new PIN when they sign in.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="user-full-name">Full name</label>
          <input id="user-full-name" required maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="user-username">Username</label>
          <input id="user-username" required maxLength={40} autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <p className="field-hint">Letters and numbers only.</p>
        </div>
        <div className="field">
          <label htmlFor="user-role">Role</label>
          <select id="user-role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {ROLES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="user-department">Department</label>
          <select id="user-department" required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
            <option value="">Select a department</option>
            {departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Create user"}</button>
        </div>
      </form>
    </div>
  );
}

function EditUserDialog({ account, onClose, onSaved }) {
  const locked = account.username === "bulxan";
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    fullName: account.fullName || "",
    role: account.role || "REPORTER",
    departmentId: account.departmentId ? String(account.departmentId) : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateUser(account.id, {
        fullName: form.fullName.trim(),
        role: locked ? "ADMIN" : form.role,
        departmentId: Number(form.departmentId),
      });
      onSaved(updated);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onSubmit={submit}>
        <h3 id="edit-user-title">Edit {account.fullName}</h3>
        <p>Username stays the same. Role and department decide what this person can do and where their feedback is filed.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="edit-user-name">Full name</label>
          <input id="edit-user-name" required maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="edit-user-role">Role</label>
          <select id="edit-user-role" required value={locked ? "ADMIN" : form.role} disabled={locked} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {ROLES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit-user-department">Department</label>
          <select id="edit-user-department" required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
            {departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save user"}</button>
        </div>
      </form>
    </div>
  );
}

function downloadDeviceKey(created) {
  const payload = {
    product: "smart-v2-device-key",
    username: created.username,
    deviceName: created.deviceName,
    deviceToken: created.deviceToken,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smart-v2-device-${created.username}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function DeviceDialog({ account, currentUsername, onClose }) {
  const [devices, setDevices] = useState([]);
  const [deviceName, setDeviceName] = useState("");
  const [pendingDevice, setPendingDevice] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pendingDevice) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pendingDevice]);

  useEffect(() => {
    fetchDevices(account.id)
      .then(setDevices)
      .catch((loadError) => setError(loadError.message));
  }, [account.id]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await registerDevice(account.id, deviceName.trim());
      if (created.username === currentUsername) writeDeviceToken(created.deviceToken);
      downloadDeviceKey(created);
      setDevices(await fetchDevices(account.id));
      setDeviceName("");
      setNotice("The device key file was downloaded. It is shown only once. Send that file to the user and have them import it on the sign-in page.");
      setSaving(false);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="device-title" onSubmit={submit}>
        <h3 id="device-title">Device for {account.fullName}</h3>
        <p>Name this browser or computer, then download the device key. The user imports that file before signing in. A browser cannot read a hardware serial number, so this key is the registered device identity.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-note" role="status">{notice}</p>}
        <div className="field">
          <label htmlFor="device-name">Device name</label>
          <input
            id="device-name"
            required
            maxLength={80}
            value={deviceName}
            placeholder="Office laptop"
            onChange={(event) => setDeviceName(event.target.value)}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
          <button type="submit" className="primary" disabled={saving || deviceName.trim().length === 0}>
            {saving ? "Creating…" : "Create device key"}
          </button>
        </div>
        <div className="user-list">
          {devices.length === 0 && (
            <p className="field-hint">
              {account.username === "bulxan"
                ? "No device key yet. This account can still sign in until the first key is created."
                : "No device key yet. This account cannot sign in until you create one."}
            </p>
          )}
          {devices.map((device) => (
            <div className="user-row" key={device.id}>
              <span>
                <strong>{device.deviceName}</strong>
                <span>{new Date(device.registeredAt).toLocaleString()}</span>
              </span>
              <button type="button" className="danger" onClick={() => setPendingDevice(device)}>Remove</button>
            </div>
          ))}
        </div>
      </form>
      {pendingDevice && (
        <PinConfirmDialog
          title={`Remove ${pendingDevice.deviceName}`}
          message="Enter your PIN to remove this device. Sign-in from that browser will stop."
          onClose={() => setPendingDevice(null)}
          onConfirm={async (pin) => {
            await revokeDevice(account.id, pendingDevice.id, pin);
            setDevices((current) => current.filter((device) => device.id !== pendingDevice.id));
          }}
        />
      )}
    </div>
  );
}

function SecurityLogDialog({ onClose }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    fetchSecurityEvents()
      .then(setEvents)
      .catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog security-log" role="dialog" aria-modal="true" aria-labelledby="security-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h3 id="security-title">Security log</h3>
            <p>Rejected sign-ins, unregistered devices, rejected PINs, and actions a role is not allowed to perform.</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {events.length === 0 && !error && <p className="field-hint">No security events yet.</p>}
        {events.length > 0 && (
          <div className="log-table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Result</th>
                  <th>IP address</th>
                  <th>System</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</td>
                    <td>{event.username || "Unknown"}</td>
                    <td>{event.action}</td>
                    <td>{event.outcome}</td>
                    <td>{event.ipAddress || "Unknown"}</td>
                    <td>{event.operatingSystem || "Unknown"}</td>
                    <td>{event.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PinConfirmDialog({ title, message, onClose, onConfirm }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onConfirm(pin);
      onClose();
    } catch (confirmError) {
      setError(confirmError.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="pin-title" onSubmit={submit}>
        <h3 id="pin-title">{title}</h3>
        <p>{message}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="confirm-delete-pin">PIN</label>
          <input
            id="confirm-delete-pin"
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            required
            value={pin}
            onChange={(event) => setPin(digitsOnly(event.target.value))}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="danger" disabled={saving || pin.length === 0}>
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ScreenshotEditor({ feedbackId, rows, setRows, existing = [], removeIds = [], setRemoveIds }) {
  const kept = existing.filter((shot) => !removeIds.includes(shot.id)).length;
  const atLimit = kept + rows.length >= 6;

  return (
    <div className="field">
      <label>Screenshots</label>
      <p className="field-hint">Optional. Add one image, or several to compare the legacy system and the new system. Each image can be up to 4 MB.</p>
      {existing.length > 0 && (
        <div className="shot-existing">
          <p className="field-hint">Saved screenshots. Remove deletes the image when you save.</p>
          {existing.map((shot) => (
            <SavedScreenshot
              key={shot.id}
              feedbackId={feedbackId}
              shot={shot}
              marked={removeIds.includes(shot.id)}
              onRemove={() => setRemoveIds([...removeIds, shot.id])}
              onUndo={() => setRemoveIds(removeIds.filter((id) => id !== shot.id))}
            />
          ))}
        </div>
      )}
      {rows.map((row, index) => (
        <div className="shot-row" key={row.key}>
          <div className="shot-row-head">
            <strong>Screenshot {kept + index + 1}</strong>
            {(rows.length > 1 || existing.length > 0) && (
              <button type="button" className="ghost" onClick={() => setRows(rows.filter((entry) => entry.key !== row.key))}>
                Remove
              </button>
            )}
          </div>
          <div className="shot-kind" role="radiogroup" aria-label={`Screenshot ${kept + index + 1}`}>
            {SCREENSHOT_NAMES.map((name) => (
              <label key={name} className="check-line">
                <input
                  type="radio"
                  name={`shot-kind-${row.key}`}
                  checked={row.label === name}
                  onChange={() => setRows(rows.map((entry) => entry.key === row.key ? { ...entry, label: name } : entry))}
                />
                {name}
              </label>
            ))}
          </div>
          <label htmlFor={`shot-file-${row.key}`}>Image</label>
          <input
            id={`shot-file-${row.key}`}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setRows(rows.map((entry) => entry.key === row.key ? { ...entry, file } : entry));
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="ghost add-shot"
        disabled={atLimit}
        onClick={() => setRows([...rows, newShotRow()])}
      >
        Add another screenshot
      </button>
    </div>
  );
}

function SavedScreenshot({ feedbackId, shot, marked, onRemove, onUndo }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    fetchScreenshot(feedbackId, shot.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [feedbackId, shot.id]);

  return (
    <div className={`saved-shot${marked ? " removed" : ""}`}>
      {url ? <img src={url} alt="" /> : <span className="saved-shot-placeholder" />}
      <span>{marked ? `${shot.label} will be removed` : shot.label}</span>
      {marked ? (
        <button type="button" className="ghost" onClick={onUndo}>Undo</button>
      ) : (
        <button type="button" className="danger" onClick={onRemove}>Remove</button>
      )}
    </div>
  );
}

function ScreenshotBrowser({ item, onClose }) {
  const shots = item.screenshots || [];
  const [selected, setSelected] = useState(shots.length === 1 ? shots[0] : null);

  useEffect(() => {
    if (selected) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  if (selected) {
    return (
      <ScreenshotDialog
        item={item}
        screenshot={selected}
        onClose={onClose}
        onBack={shots.length > 1 ? () => setSelected(null) : null}
      />
    );
  }

  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="shot-list-title">
        <h3 id="shot-list-title">{item.title}</h3>
        <p>Choose a screenshot to view.</p>
        <ul className="shot-list">
          {shots.map((shot, index) => (
            <li key={shot.id}>
              <button type="button" onClick={() => setSelected(shot)}>
                <span className="shot-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{shot.label}</span>
              </button>
            </li>
          ))}
          </ul>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ScreenshotDialog({ item, screenshot, onClose, onBack }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    function onKey(event) {
      if (event.key === "Escape") {
        if (onBack) onBack();
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    fetchScreenshot(item.id, screenshot.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, screenshot.id, onClose, onBack]);

  return (
    <div className="overlay">
      <div className="dialog screenshot-view" role="dialog" aria-modal="true" aria-labelledby="screenshot-title">
        <div className={`shot-toolbar${onBack ? " split" : ""}`}>
          {onBack && <button type="button" className="ghost" onClick={onBack}>Back</button>}
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
        <h3 id="screenshot-title">{screenshot.label}</h3>
        <p>{item.title}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!error && !url && <p className="field-hint">Opening screenshot…</p>}
        {url && <img src={url} alt={screenshot.label} />}
      </div>
    </div>
  );
}
