import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const modules = [
  { id: "herd", label: "Herd", endpoint: "animals", columns: [["tag", "Tag"], ["type", "Type"], ["sex", "Sex"], ["status", "Status"]] },
  { id: "health", label: "Health", endpoint: "health-records", columns: [["pig_id", "Pig"], ["type", "Record"], ["status", "Status"], ["diagnosis", "Diagnosis"], ["visit_date", "Date"]] },
  { id: "breeding", label: "Breeding", endpoint: "pregnancies", columns: [["sow_id", "Sow"], ["status", "Status"], ["mating_date", "Mating date"], ["expected_farrowing_date", "Expected farrowing"]] },
  { id: "feed", label: "Feed", endpoint: "feed", columns: [["record_type", "Record"], ["name", "Feed"], ["quantity", "Quantity"], ["unit", "Unit"], ["unit_cost", "Unit cost"]] },
  { id: "inventory", label: "Inventory", endpoint: "inventory/items", columns: [["name", "Item"], ["category", "Category"], ["quantity", "Quantity"], ["unit", "Unit"], ["minimum_level", "Minimum"]] },
  { id: "growth", label: "Growth", endpoint: "growth-records", columns: [["animal_id", "Animal"], ["weight", "Weight"], ["height", "Height"], ["measured_at", "Measured"]] },
  { id: "reports", label: "Reports", endpoint: "reports/metrics", columns: [] },
];

function rowsFor(moduleId, payload) {
  if (moduleId === "feed") {
    return [
      ...(payload?.stock || []).map((item) => ({ ...item, record_type: "Stock" })),
      ...(payload?.usage || []).map((item) => ({ ...item, name: item.feed_name, record_type: "Usage" })),
    ];
  }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function FarmOperationsWorkspace({ farmId, canView, refreshKey = 0 }) {
  const [moduleId, setModuleId] = useState("herd");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeModule = useMemo(() => modules.find((item) => item.id === moduleId) || modules[0], [moduleId]);

  useEffect(() => {
    if (!farmId || !canView) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setPayload(null);
    api.get(`/farms/${encodeURIComponent(farmId)}/${activeModule.endpoint}`, {
      params: { _refresh: Date.now() },
    })
      .then((response) => {
        if (active) setPayload(response.data?.data ?? response.data ?? {});
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || `Could not load ${activeModule.label.toLowerCase()} data.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [farmId, canView, activeModule, refreshKey]);

  if (!canView) {
    return <section className="panel-card operations-state">Your CRM role does not have access to farm operations.</section>;
  }
  if (!farmId) {
    return <section className="panel-card operations-state">Select a farm to view its operational records.</section>;
  }

  const rows = rowsFor(moduleId, payload);
  const reportMetrics = moduleId === "reports" && payload && typeof payload === "object"
    ? (payload.metrics || payload.data || payload)
    : null;
  const metrics = reportMetrics && !Array.isArray(reportMetrics) && typeof reportMetrics === "object"
    ? Object.entries(reportMetrics)
    : [];

  return (
    <section className="operations-workspace">
      <div className="operations-module-tabs" role="tablist" aria-label="Farm operations">
        {modules.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={moduleId === item.id}
            className={moduleId === item.id ? "selected" : ""}
            onClick={() => setModuleId(item.id)}
          >{item.label}</button>
        ))}
      </div>
      {loading ? (
        <div className="panel-card operations-state">Loading {activeModule.label.toLowerCase()}…</div>
      ) : error ? (
        <div className="panel-card operations-state error" role="alert">{error}</div>
      ) : moduleId === "reports" ? (
        <div className="operations-metrics">
          {metrics.length ? metrics.map(([label, value]) => (
            <article className="panel-card operations-metric" key={label}>
              <span>{label.replaceAll("_", " ")}</span>
              <strong>{displayValue(value)}</strong>
            </article>
          )) : <div className="panel-card operations-state">No report metrics are available for this farm.</div>}
        </div>
      ) : (
        <div className="panel-card operations-table-card">
          {rows.length ? (
            <div className="operations-table-scroll">
              <table className="operations-table">
                <thead><tr>{activeModule.columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id || `${moduleId}-${index}`}>
                      {activeModule.columns.map(([key]) => <td key={key}>{displayValue(row[key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="operations-state">No {activeModule.label.toLowerCase()} records for this farm yet.</div>
          )}
        </div>
      )}
    </section>
  );
}
