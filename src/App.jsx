import { useEffect, useMemo, useState } from "react";
import {
  createFeedback,
  createModule,
  fetchFeedback,
  fetchModules,
  updateStatus,
} from "./api";
import { exportFeedbackPdf } from "./exportPdf";
import { CATEGORIES, STATUSES, categoryById } from "./labels";
import "./App.css";

const emptyModuleForm = { name: "", description: "", icon: "" };
const emptyFeedbackForm = {
  moduleId: "",
  title: "",
  details: "",
  category: "LEGACY_PARITY",
  status: "IN_PROGRESS",
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

export default function App() {
  const [modules, setModules] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleId, setModuleId] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    const [nextModules, nextItems] = await Promise.all([fetchModules(), fetchFeedback()]);
    setModules(nextModules);
    setItems(nextItems);
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const moduleCounts = useMemo(() => {
    const counts = { all: 0 };
    modules.forEach((module) => {
      counts[module.id] = 0;
    });
    items.forEach((item) => {
      const categoryOk = category === "all" || item.category === category;
      const statusOk = status === "all" || item.status === status;
      if (categoryOk && statusOk && matchesQuery(item, normalizedQuery)) {
        counts.all += 1;
        counts[item.moduleId] = (counts[item.moduleId] || 0) + 1;
      }
    });
    return counts;
  }, [items, modules, category, status, normalizedQuery]);

  const categoryCounts = useMemo(() => {
    const counts = { all: 0 };
    CATEGORIES.forEach((entry) => {
      counts[entry.id] = 0;
    });
    items.forEach((item) => {
      const moduleOk = moduleId === "all" || item.moduleId === moduleId;
      const statusOk = status === "all" || item.status === status;
      if (moduleOk && statusOk && matchesQuery(item, normalizedQuery)) {
        counts.all += 1;
        counts[item.category] += 1;
      }
    });
    return counts;
  }, [items, moduleId, status, normalizedQuery]);

  const statusCounts = useMemo(() => {
    const counts = {};
    STATUSES.forEach((entry) => {
      counts[entry.id] = 0;
    });
    items.forEach((item) => {
      const moduleOk = moduleId === "all" || item.moduleId === moduleId;
      const categoryOk = category === "all" || item.category === category;
      if (moduleOk && categoryOk && matchesQuery(item, normalizedQuery)) {
        counts[item.status] += 1;
      }
    });
    return counts;
  }, [items, moduleId, category, normalizedQuery]);

  const visible = items.filter((item) => {
    const moduleOk = moduleId === "all" || item.moduleId === moduleId;
    const categoryOk = category === "all" || item.category === category;
    const statusOk = status === "all" || item.status === status;
    return moduleOk && categoryOk && statusOk && matchesQuery(item, normalizedQuery);
  });

  const groups = [];
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

  const selectedModule = modules.find((module) => module.id === moduleId);
  const summary = moduleId === "all" && category === "all" && status === "all" && !normalizedQuery
    ? "Showing all feedback"
    : `Showing ${category === "all" ? "all feedback" : categoryById(category).label}${
        status === "all" ? "" : `, ${STATUSES.find((entry) => entry.id === status).label.toLowerCase()}`
      } in ${selectedModule ? selectedModule.name : "all modules"}`;

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
    const categoryOk = category === "all" || item.category === category;
    return item.status === "IN_PROGRESS" && moduleOk && categoryOk && matchesQuery(item, normalizedQuery);
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
        typeLabel,
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
    setModuleId(created.item.moduleId);
    setCategory(created.item.category);
    setStatus(created.item.status);
    setDialogOpen(false);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Smart V2 Review</h1>
          <p>Browse feedback by module</p>
        </div>
        <p className="menu-label">Modules</p>
        <nav className="menu" aria-label="Feedback modules">
          <button type="button" className={moduleId === "all" ? "active" : ""} onClick={() => setModuleId("all")}>
            <span className="menu-name"><span>All modules</span></span>
            <span className="count">{moduleCounts.all || 0}</span>
          </button>
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={moduleId === module.id ? "active" : ""}
              onClick={() => setModuleId(module.id)}
            >
              <span className="menu-name">
                <span>{module.icon || "📌"}</span>
                <span>{module.name}</span>
              </span>
              <span className="count">{moduleCounts[module.id] || 0}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="side-action" onClick={() => setDialogOpen(true)}>
          Register
        </button>
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <h2>Smart V2 System Review</h2>
            <p>
              Functional and UI/UX feedback compared with the legacy system.
              Choose a module, filter by type, and track whether each issue is in progress, an expected feature, or completed.
            </p>
          </div>
          <button type="button" className="primary" onClick={() => setDialogOpen(true)}>
            Register feedback
          </button>
        </header>

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
            {summary.includes("Showing all feedback") && summary === "Showing all feedback"
              ? <>Showing <strong>all feedback</strong></>
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

        {!loading && groups.map((group) => (
          <section className="section-card" key={group.moduleId}>
            <h3>{group.moduleIcon || "📌"} {group.moduleName}</h3>
            <div className="items">
              {group.items.map((item) => {
                const categoryMeta = categoryById(item.category);
                return (
                  <article className={`item ${item.status}`} key={item.id}>
                    <div className="item-top">
                      <span className="item-meta">
                        <span className="index">{String(item.itemNumber).padStart(2, "0")}</span>
                        <span className="created">Created {formatCreated(item.createdAt)}</span>
                      </span>
                      <span className={`tag ${categoryMeta?.dot || ""}`}>{categoryMeta?.label}</span>
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
                            disabled={pendingId === item.id}
                            onClick={() => changeStatus(item, entry.id)}
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && visible.length === 0 && (
          <div className="empty">No feedback matches this view. Clear a filter or register a new item.</div>
        )}

        <footer>Smart-Remit V2 Engineering & Product Feedback Report</footer>
      </main>

      {dialogOpen && (
        <RegisterDialog
          modules={modules}
          initialModuleId={moduleId === "all" ? modules[0]?.id ?? "" : moduleId}
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function RegisterDialog({ modules, initialModuleId, onClose, onCreated }) {
  const [tab, setTab] = useState(modules.length ? "feedback" : "module");
  const [moduleForm, setModuleForm] = useState(emptyModuleForm);
  const [feedbackForm, setFeedbackForm] = useState({
    ...emptyFeedbackForm,
    moduleId: initialModuleId === "" ? "" : String(initialModuleId),
  });
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitModule(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const module = await createModule({
        name: moduleForm.name.trim(),
        description: moduleForm.description.trim(),
        icon: moduleForm.icon.trim(),
      });
      setModuleForm(emptyModuleForm);
      setFeedbackForm((current) => ({ ...current, moduleId: String(module.id) }));
      setTab("feedback");
      setNotice(`${module.name} is saved. Add the feedback for it next.`);
      setSaving(false);
      onCreated({ kind: "module", module });
    } catch (submitError) {
      setFormError(submitError.message);
      setSaving(false);
    }
  }

  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedbackForm.moduleId) {
      setFormError("Register a module before adding feedback.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const item = await createFeedback({
        moduleId: Number(feedbackForm.moduleId),
        title: feedbackForm.title.trim(),
        details: feedbackForm.details.trim(),
        category: feedbackForm.category,
        status: feedbackForm.status,
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
        <h3 id="register-title">Register</h3>
        <p>Add a module first, then record feedback against it and choose the feedback type.</p>
        <div className="tabs" role="tablist">
          <button type="button" className={tab === "module" ? "active" : ""} onClick={() => setTab("module")}>
            Module
          </button>
          <button type="button" className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")}>
            Feedback
          </button>
        </div>

        {notice && <p className="form-note">{notice}</p>}
        {formError && <p className="form-error">{formError}</p>}

        {tab === "module" ? (
          <form onSubmit={submitModule}>
            <div className="field">
              <label htmlFor="module-name">Module name</label>
              <input
                id="module-name"
                required
                maxLength={120}
                value={moduleForm.name}
                onChange={(event) => setModuleForm({ ...moduleForm, name: event.target.value })}
                placeholder="Agent Creation"
              />
            </div>
            <div className="field">
              <label htmlFor="module-icon">Icon</label>
              <input
                id="module-icon"
                maxLength={16}
                value={moduleForm.icon}
                onChange={(event) => setModuleForm({ ...moduleForm, icon: event.target.value })}
                placeholder="Optional, for example 🏢"
              />
            </div>
            <div className="field">
              <label htmlFor="module-description">Description</label>
              <textarea
                id="module-description"
                maxLength={1000}
                value={moduleForm.description}
                onChange={(event) => setModuleForm({ ...moduleForm, description: event.target.value })}
                placeholder="What this module covers"
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Saving…" : "Save module"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitFeedback}>
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
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary" disabled={saving || modules.length === 0}>
                {saving ? "Saving…" : "Save feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
