// Client-side only, mirrors csv-export.ts's shape but produces a real .xlsx
// file — some downstream tools (and most non-technical staff) expect an
// actual workbook rather than a CSV with an .xlsx extension slapped on.
// exceljs is dynamically imported (same pattern as pdf-export.ts's
// html2canvas/jspdf) since it's a large library only ever needed once
// someone actually clicks "Export" — a static import would ship it in every
// page's initial bundle that merely imports this module.
export async function downloadXlsx(filename: string, headers: string[], rows: (string | number)[][]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
