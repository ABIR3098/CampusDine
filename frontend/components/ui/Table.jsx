// CampusDine UI: Modular Responsive Table Component
(function () {
  function CDTable({
    columns = [], // { key, header, render, className }
    data = [],
    emptyMessage = "No records found.",
    loading = false,
    className = ""
  }) {
    if (loading) {
      return (
        <div className="p-8 text-center text-slate-400">
          <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
          <p className="text-xs">Loading data...</p>
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
          <p className="text-sm font-medium">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className={`overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 ${className}`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th key={col.key || idx} className={`px-4 py-3.5 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
              >
                {columns.map((col, colIdx) => (
                  <td key={col.key || colIdx} className={`px-4 py-3 text-slate-700 dark:text-slate-200 ${col.className || ""}`}>
                    {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Table = CDTable;
})();
