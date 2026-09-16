import ExcelJS from "exceljs";

const ALSORG_BOM_COMPANY_LINE =
  "Alsorg Interior's Pvt Ltd , Begumpur Khatola, Rectangle No.11,Kharsa No. 2 & 9, Behrampur Road,GGN (Haryana)";

const ALSORG_BOM_COLUMNS = [
  { header: "SL", width: 5 },
  { header: "Material", width: 58.33203125 },
  { header: "Material Type", width: 14.6640625 },
  { header: "Code", width: 39.44140625 },
  { header: "Section", width: 8.33203125 },
  { header: "Finish", width: 6.5546875 },
  { header: "Size", width: 22.33203125 },
  { header: "Thk", width: 11.5546875 },
  { header: "Uom", width: 5.5546875 },
  { header: "Qty", width: 4.5546875 },
  { header: "REMARK", width: 9.44140625 },
];

const CATEGORY_ORDER = [
  "WOOD",
  "VENEER",
  "LAMINATE",
  "METAL",
  "STONE_TILE",
  "GLASS_MIRROR",
  "FABRIC_LEATHER",
  "UPHOLSTERY",
  "HARDWARE",
  "PAINT_POLISH",
  "ADHESIVE_CHEMICAL",
  "PACKAGING",
  "RAW_MATERIAL",
  "OTHER",
];

const CATEGORY_LABELS = {
  WOOD: "Wood Requirement",
  VENEER: "Veneer Requirement",
  LAMINATE: "Laminate Requirement",
  METAL: "Metal Requirement",
  STONE_TILE: "Stone / Tile Requirement",
  GLASS_MIRROR: "Glass / Mirror Requirement",
  FABRIC_LEATHER: "Fabric / Leather Requirement",
  UPHOLSTERY: "Upholstery Requirement",
  HARDWARE: "Hardware Requirement",
  PAINT_POLISH: "Polish / Paint Requirement",
  ADHESIVE_CHEMICAL: "Adhesive / Chemical Requirement",
  PACKAGING: "Packaging Requirement",
  RAW_MATERIAL: "Raw Material Requirement",
  OTHER: "Other Material Requirement",
};

const safeText = (value) => String(value ?? "").trim();
const upper = (value) => safeText(value).toUpperCase();
const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCategory = (value) => {
  const raw = upper(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!raw) return "OTHER";

  if (raw.includes("WOOD") || raw.includes("PLY") || raw.includes("MDF") || raw.includes("HDHMR")) return "WOOD";
  if (raw.includes("VENEER")) return "VENEER";
  if (raw.includes("LAMINATE")) return "LAMINATE";
  if (raw.includes("METAL") || raw.includes("STEEL") || raw.includes("ALUMIN")) return "METAL";
  if (raw.includes("STONE") || raw.includes("MARBLE") || raw.includes("GRANITE") || raw.includes("TILE")) return "STONE_TILE";
  if (raw.includes("GLASS") || raw.includes("MIRROR")) return "GLASS_MIRROR";
  if (raw.includes("FABRIC") || raw.includes("LEATHER")) return "FABRIC_LEATHER";
  if (raw.includes("UPHOLSTERY")) return "UPHOLSTERY";
  if (raw.includes("HARDWARE") || raw.includes("HINGE") || raw.includes("HANDLE")) return "HARDWARE";
  if (raw.includes("PAINT") || raw.includes("POLISH") || raw.includes("FINISH")) return "PAINT_POLISH";
  if (raw.includes("ADHESIVE") || raw.includes("CHEMICAL") || raw.includes("GLUE")) return "ADHESIVE_CHEMICAL";
  if (raw.includes("PACK")) return "PACKAGING";
  if (raw.includes("RAW_MATERIAL")) return "RAW_MATERIAL";
  return CATEGORY_ORDER.includes(raw) ? raw : "OTHER";
};

const splitSpecification = (value) => {
  const text = safeText(value);
  const result = { section: "", finish: "", size: "", thickness: "" };
  if (!text) return result;

  const parts = text
    .split(/\s*(?:\||•|·|;)\s*/)
    .map((part) => safeText(part))
    .filter(Boolean);

  const unlabelled = [];
  for (const part of parts.length ? parts : [text]) {
    const match = part.match(/^(section|finish|size|thk|thickness)\s*[:=\-]\s*(.+)$/i);
    if (!match) {
      unlabelled.push(part);
      continue;
    }
    const key = match[1].toLowerCase();
    const payload = safeText(match[2]);
    if (key === "section") result.section = payload;
    else if (key === "finish") result.finish = payload;
    else if (key === "size") result.size = payload;
    else result.thickness = payload;
  }

  if (unlabelled.length) {
    const remainder = unlabelled.join(" · ");
    result.size = result.size ? `${result.size} · ${remainder}` : remainder;
  }
  return result;
};

const thinBlackBorder = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const borderRow = (sheet, rowNumber) => {
  for (let column = 1; column <= 11; column += 1) {
    sheet.getCell(rowNumber, column).border = thinBlackBorder;
  }
};

const yellowFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const greyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

const safeDownloadName = (value) =>
  safeText(value || "ALSORG_Material_Requirement")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Export a MatFlow BOM in the ALSORG Material Requirement workbook format.
 * The layout intentionally mirrors the approved workbook used before the
 * MatFlow rebuild while consuming the new simplified BOM response shape.
 */
export async function downloadMatFlowBomExcel(bom) {
  if (!bom || typeof bom !== "object") {
    throw new Error("A BOM is required for download.");
  }

  const lines = Array.isArray(bom.lines) ? bom.lines : [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ALSORG FlowSuite / MatFlow";
  workbook.lastModifiedBy = safeText(bom.estimateBy || bom.submittedBy || "ALSORG");
  workbook.company = "ALSORG";
  workbook.title = safeText(bom.bomNumber || "ALSORG Material Requirement");
  workbook.subject = "Product Bill of Material / Material Requirement";
  workbook.category = "MatFlow BOM";
  workbook.description = "ALSORG MatFlow BOM in the approved Material Requirement format.";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("BOM", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.views = [{ showGridLines: false }];

  ALSORG_BOM_COLUMNS.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  sheet.mergeCells("A1:K1");
  const companyCell = sheet.getCell("A1");
  companyCell.value = ALSORG_BOM_COMPANY_LINE;
  companyCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
  companyCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 20;
  borderRow(sheet, 1);

  sheet.mergeCells("A2:K2");
  const titleCell = sheet.getCell("A2");
  titleCell.value = "Material Requirement";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF000000" } };
  titleCell.fill = yellowFill;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 26;
  for (let column = 1; column <= 11; column += 1) sheet.getCell(2, column).fill = yellowFill;
  borderRow(sheet, 2);

  sheet.mergeCells("A3:F3");
  sheet.mergeCells("G3:J3");
  sheet.getCell("A3").value = `PROJECT :- ${safeText(bom.projectName || bom.projectCode || "-")}`;
  sheet.getCell("G3").value = `PD No. :- ${safeText(bom.projectCode || "-")}`;

  sheet.mergeCells("A4:F4");
  sheet.mergeCells("G4:J4");
  sheet.getCell("A4").value = `Drawing Title :- ${safeText(bom.productName || bom.drawingNo || "-")}`;
  sheet.getCell("G4").value = `Estimate By :- ${safeText(bom.estimateBy || bom.submittedBy || bom.releasedBy || "-")}`;

  for (const rowNumber of [3, 4]) {
    sheet.getRow(rowNumber).height = 20;
    for (let column = 1; column <= 11; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      cell.font = { name: "Calibri", size: 12, color: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    borderRow(sheet, rowNumber);
  }

  const grouped = new Map();
  lines.forEach((line) => {
    const rawCategory = safeText(line?.category || "OTHER");
    const key = normalizeCategory(rawCategory);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ...line, _rawCategory: rawCategory });
  });

  const categories = Array.from(grouped.keys()).sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
  });

  let rowNumber = 5;
  let serial = 1;

  const writeSectionHeader = (category) => {
    sheet.mergeCells(rowNumber, 1, rowNumber, 11);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = CATEGORY_LABELS[category] || "Other Material Requirement";
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
    cell.fill = yellowFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    for (let column = 1; column <= 11; column += 1) sheet.getCell(rowNumber, column).fill = yellowFill;
    sheet.getRow(rowNumber).height = 22;
    borderRow(sheet, rowNumber);
    rowNumber += 1;
  };

  const writeColumnHeader = () => {
    ALSORG_BOM_COLUMNS.forEach((column, index) => {
      const cell = sheet.getCell(rowNumber, index + 1);
      cell.value = column.header;
      cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
      cell.fill = greyFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBlackBorder;
    });
    sheet.getRow(rowNumber).height = 22;
    rowNumber += 1;
  };

  const writeMaterialRow = (line) => {
    const specification = splitSpecification(line?.specification);
    const quantity = numberOr(line?.netRequiredQty, numberOr(line?.requiredQty, 0));
    const values = [
      serial,
      safeText(line?.materialName),
      safeText(line?._rawCategory),
      safeText(line?.materialCode),
      specification.section,
      specification.finish,
      specification.size,
      specification.thickness,
      safeText(line?.uom),
      quantity,
      safeText(line?.remarks),
    ];

    values.forEach((value, index) => {
      const cell = sheet.getCell(rowNumber, index + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 12, color: { argb: "FF000000" } };
      cell.border = thinBlackBorder;
      cell.alignment = {
        horizontal: [1, 9, 10].includes(index + 1) ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    });
    sheet.getCell(rowNumber, 10).numFmt = "0.###";
    sheet.getRow(rowNumber).height = 20;
    serial += 1;
    rowNumber += 1;
  };

  if (!categories.length) {
    writeSectionHeader("OTHER");
    writeColumnHeader();
    sheet.mergeCells(rowNumber, 1, rowNumber, 11);
    const emptyCell = sheet.getCell(rowNumber, 1);
    emptyCell.value = "No material lines have been added to this BOM.";
    emptyCell.font = { name: "Calibri", size: 12, italic: true, color: { argb: "FF666666" } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(rowNumber).height = 24;
    borderRow(sheet, rowNumber);
  } else {
    categories.forEach((category) => {
      writeSectionHeader(category);
      writeColumnHeader();
      (grouped.get(category) || [])
        .slice()
        .sort((left, right) => numberOr(left?.lineNo, 0) - numberOr(right?.lineNo, 0))
        .forEach(writeMaterialRow);
    });
  }

  const finalRow = Math.max(rowNumber, sheet.rowCount);
  sheet.pageSetup.printArea = `A1:K${finalRow}`;
  sheet.pageSetup.horizontalCentered = true;
  sheet.pageSetup.verticalCentered = false;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeDownloadName(bom.bomNumber)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
