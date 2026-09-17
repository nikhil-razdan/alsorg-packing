import ExcelJS from "exceljs";

const text = (value) => String(value ?? "").trim();
const asCell = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  return JSON.stringify(value);
};

const widthFor = (label, rows, column) => {
  const values = rows.slice(0, 500).map((row) => text(typeof column.value === "function" ? column.value(row) : row?.[column.key]));
  return Math.max(11, Math.min(38, Math.max(text(label).length, ...values.map((value) => value.length)) + 2));
};

const safeFileName = (value) => text(value || "MatFlow_Report").replace(/[^a-z0-9._-]+/gi, "_");

const columnLetter = (number) => {
  let n = Math.max(1, Number(number) || 1);
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
};

/**
 * Small, department-report exporter. It intentionally exports only the columns
 * explicitly supplied by each report so Design never receives Engineering-only
 * fields and vice versa.
 */
export async function downloadMatFlowExcel({
  fileName,
  sheetName = "Report",
  title = "MatFlow Report",
  subtitle = "",
  rows = [],
  columns = [],
  metadata = [],
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ALSORG FlowSuite / MatFlow";
  workbook.company = "ALSORG";
  workbook.created = new Date();

  const safeSheetName = String(sheetName || "Report").replace(/[\\/*?:\[\]]/g, " ").slice(0, 31) || "Report";
  const sheet = workbook.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];

  const resolvedColumns = columns.filter((column) => column && column.key);
  const lastCol = Math.max(1, resolvedColumns.length);

  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 27;

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = subtitle || `Exported ${new Date().toLocaleString("en-IN")}`;
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF55627A" } };

  sheet.mergeCells(3, 1, 3, lastCol);
  sheet.getCell(3, 1).value = metadata.filter(Boolean).join("  •  ");
  sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF7A879B" } };

  const header = sheet.getRow(5);
  resolvedColumns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.label || column.key;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  header.height = 24;

  rows.forEach((row, rowIndex) => {
    const target = sheet.getRow(6 + rowIndex);
    resolvedColumns.forEach((column, colIndex) => {
      const value = typeof column.value === "function" ? column.value(row) : row?.[column.key];
      const cell = target.getCell(colIndex + 1);
      cell.value = asCell(value);
      cell.alignment = { vertical: "top", wrapText: true };
      if (column.numFmt) cell.numFmt = column.numFmt;
    });
    if (rowIndex % 2 === 1) {
      target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  resolvedColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width || widthFor(column.label || column.key, rows, column);
  });

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: lastCol } };
  sheet.pageSetup.printArea = `A1:${columnLetter(lastCol)}${Math.max(5, 5 + rows.length)}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(fileName || title)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
