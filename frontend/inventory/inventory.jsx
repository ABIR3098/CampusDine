// Kitchen inventory screens for the Staff panel and the Admin panel.
// Loaded by campusdine.html (compiled in the browser by Babel) and published as window.CDInventory.
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;

  async function call(apiBase, token, path, { method = "GET", body } = {}) {
    const res = await fetch(`${apiBase}/api/inventory${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  const when = (v) => (v ? new Date(v).toLocaleString() : "—");

  const STATUS_STYLE = {
    pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
    approved: { bg: "#DBEAFE", fg: "#1E40AF", label: "Approved" },
    rejected: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
    purchased: { bg: "#DCFCE7", fg: "#166534", label: "Purchased" },
  };
  const LEVEL_STYLE = {
