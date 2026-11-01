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
