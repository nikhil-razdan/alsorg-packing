import ExcelJS from "exceljs";

const safeText = (value) => String(value ?? "").trim();
const cleanMaterialName = (value) =>
    safeText(value)
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
const cleanSupplier = (value) => {
    const result = cleanMaterialName(value);
    return /^(N\/?A|NA|NONE|-)?$/i.test(result) ? "" : result;
};
const upper = (value) => safeText(value).toUpperCase();
const numberOr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeHeader = (value) =>
    safeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const slug = (value) =>
    upper(value)
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);

const hashText = (value) => {
    let hash = 2166136261;
    for (const char of safeText(value)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
};

export const buildImportedMaterialCode = (name, prefix = "MAT", identity = "") => {
    const cleanName = cleanMaterialName(name);
    const base = slug(cleanName).split("-").slice(0, 3).join("-") || "ITEM";
    const hashSource = [cleanName, safeText(identity)].filter(Boolean).join("|");
    return `${upper(prefix || "MAT")}-${base}-${hashText(hashSource)}`.slice(0, 56);
};

const dedupe = (rows) => {
    const seen = new Set();
    return rows.filter((row) => {
        const code = upper(row.materialCode);
        const fallbackKey = [
            normalizeHeader(row.materialName),
            normalizeHeader(row.specification),
            upper(row.uom),
            normalizeHeader(row.preferredSupplier),
        ].join("|");
        const key = code ? `CODE:${code}` : `IDENTITY:${fallbackKey}`;
        if (!safeText(row.materialName) || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const categoryFromName = (name, fallback = "OTHER") => {
    const value = normalizeHeader(name);
    if (value.includes("veneer")) return "VENEER";
    if (/(laminate)/.test(value)) return "LAMINATE";
    if (/(ply|plywood|hdhmr|mdf|wood|edge band)/.test(value)) return "WOOD";
    if (/(steel|metal|aluminium|aluminum|brass|iron|crc|stainless)/.test(value)) return "METAL";
    if (/(stone|marble|granite|tile)/.test(value)) return "STONE_TILE";
    if (/(glass|mirror)/.test(value)) return "GLASS_MIRROR";
    if (/(fabric|leather)/.test(value)) return "FABRIC_LEATHER";
    if (/(upholstery)/.test(value)) return "UPHOLSTERY";
    if (/(hinge|screw|bolt|nut|dowel|connector|handle|fitting|hardware|plate|buffer|insert|bracket|catcher)/.test(value)) return "HARDWARE";
    if (/(paint|primer|sealer|stain|matt|polish)/.test(value)) return "PAINT_POLISH";
    if (/(thinner|hardener|adhesive|glue|chemical)/.test(value)) return "ADHESIVE_CHEMICAL";
    return upper(fallback || "OTHER");
};

const uomFromText = (value, fallback = "PCS") => {
    const text = upper(value).replace(/\./g, "");
    if (!text) return upper(fallback || "PCS");
    if (text.includes("SQ FT") || text.includes("SQFT") || text.includes("SQUARE FEET")) return "SQFT";
    if (text.includes("RFT")) return "RFT";
    if (text.includes("MTR") || text.includes("METER") || text.includes("METRE")) return "MTR";
    if (text.includes("SHEET")) return "SHEET";
    if (text.includes("SET")) return "SET";
    if (text.includes("KG") || text.includes("GRAM")) return "KG";
    if (text.includes("PCS") || text.includes("PC") || text.includes("NOS") || text.includes("NO")) return "PCS";
    return upper(value || fallback || "PCS");
};

const materialRow = ({
    materialName,
    materialCode,
    category,
    specification,
    uom,
    preferredSupplier,
    sourceSection = "",
    sourceRow = null,
}, defaults) => {
    const name = cleanMaterialName(materialName);
    if (!name) return null;
    const spec = safeText(specification);
    const normalizedUom = uomFromText(uom, defaults.uom);
    const supplier = cleanSupplier(preferredSupplier);
    const identity = [spec, normalizedUom, supplier].filter(Boolean).join("|");
    return {
        materialCode: upper(materialCode) || buildImportedMaterialCode(name, defaults.codePrefix, identity),
        materialName: name,
        category: upper(category) || categoryFromName(name, defaults.category),
        specification: spec || null,
        uom: normalizedUom,
        preferredSupplier: supplier || null,
        active: true,
        sourceSection,
        sourceRow,
    };
};

const cellText = (row, index) => {
    const value = row.getCell(index).value;
    if (value && typeof value === "object" && "text" in value) return safeText(value.text);
    return safeText(value);
};

const parseCanonicalTable = (sheet, defaults) => {
    const rows = [];
    let headerRow = null;
    let headers = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (headerRow) return;
        const values = Array.from({ length: Math.max(1, row.cellCount) }, (_, index) => normalizeHeader(cellText(row, index + 1)));
        const nameIndex = values.findIndex((value) => ["material name", "material", "item", "item name", "material description", "description"].includes(value));
        if (nameIndex >= 0 && values.some((value) => value.includes("uom") || value === "unit" || value.includes("category") || value.includes("code"))) {
            headerRow = rowNumber;
            headers = values;
        }
    });

    if (!headerRow) return rows;

    const indexOfAny = (...aliases) => headers.findIndex((header) => aliases.includes(header));
    const nameIdx = indexOfAny("material name", "material", "item", "item name", "material description", "description");
    const codeIdx = indexOfAny("material code", "code", "item code", "sku", "item sku");
    const categoryIdx = indexOfAny("category", "material category", "section");
    const uomIdx = indexOfAny("uom", "unit", "units");
    const specIdx = indexOfAny("specification", "spec", "size specification");
    const supplierIdx = indexOfAny("preferred supplier", "supplier", "brand", "vendor");

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRow) return;
        const name = nameIdx >= 0 ? cellText(row, nameIdx + 1) : "";
        if (!name) return;
        const parsed = materialRow({
            materialName: name,
            materialCode: codeIdx >= 0 ? cellText(row, codeIdx + 1) : "",
            category: categoryIdx >= 0 ? cellText(row, categoryIdx + 1) : "",
            specification: specIdx >= 0 ? cellText(row, specIdx + 1) : "",
            uom: uomIdx >= 0 ? cellText(row, uomIdx + 1) : "",
            preferredSupplier: supplierIdx >= 0 ? cellText(row, supplierIdx + 1) : "",
            sourceSection: "Canonical Material Table",
            sourceRow: rowNumber,
        }, defaults);
        if (parsed) rows.push(parsed);
    });

    return rows;
};

const parseOneColumnList = (sheet, defaults) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const name = cellText(row, 1);
        if (!name) return;
        const normalized = normalizeHeader(name);
        if (["material", "material name", "item", "item name"].includes(normalized)) return;
        const parsed = materialRow({
            materialName: name,
            category: defaults.category,
            uom: defaults.uom,
            sourceSection: "One-column Material Catalogue",
            sourceRow: rowNumber,
        }, defaults);
        if (parsed) rows.push(parsed);
    });
    return rows;
};

const parseAlsorgBomSheet = (sheet, defaults) => {
    const rows = [];
    let section = "";

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const a = cellText(row, 1);
        const b = cellText(row, 2);
        const c = cellText(row, 3);
        const d = cellText(row, 4);
        const e = cellText(row, 5);
        const f = cellText(row, 6);
        const g = cellText(row, 7);
        const h = cellText(row, 8);
        const i = cellText(row, 9);
        const rowText = normalizeHeader([a, b, c, d, e, f, g, h, i].filter(Boolean).join(" "));

        if (rowText.startsWith("metal requirement")) { section = "METAL"; return; }
        if (rowText.startsWith("material requirement")) { section = "MATERIAL"; return; }
        if (rowText.includes("hardware requirement")) { section = "HARDWARE"; return; }
        if (rowText.startsWith("polish paint requirement")) { section = "POLISH_PAINT"; return; }
        if (rowText.startsWith("fabric leather")) { section = "FABRIC"; return; }

        if (!section || !/^\d+(\.\d+)?$/.test(a)) return;

        let parsed = null;
        if (section === "METAL") {
            const metalParts = safeText(b)
                .split(/\s*_+\s*/)
                .map((value) => cleanMaterialName(value))
                .filter(Boolean);
            const materialBase = metalParts[0] || cleanMaterialName(b);
            const brand = metalParts.slice(1).join(" ") || "";
            const name = [materialBase, d, e, f].filter(Boolean).map(cleanMaterialName).join(" · ");
            parsed = materialRow({
                materialName: name,
                category: "METAL",
                specification: [c && `Finish ${cleanMaterialName(c)}`, i && `Remark ${cleanMaterialName(i)}`].filter(Boolean).join(" · "),
                uom: h,
                preferredSupplier: brand,
                sourceSection: "Metal Requirement",
                sourceRow: rowNumber,
            }, defaults);
        } else if (section === "MATERIAL") {
            const baseName = cleanMaterialName(b);
            const variantName = [baseName, e, f].filter(Boolean).map(cleanMaterialName).join(" · ");
            parsed = materialRow({
                materialName: variantName,
                category: categoryFromName(baseName, "WOOD"),
                specification: [i && `Remark ${cleanMaterialName(i)}`].filter(Boolean).join(" · "),
                uom: h,
                preferredSupplier: c,
                sourceSection: "Material Requirement",
                sourceRow: rowNumber,
            }, defaults);
        } else if (section === "HARDWARE") {
            parsed = materialRow({
                materialName: cleanMaterialName(b),
                materialCode: e,
                category: "HARDWARE",
                specification: i,
                uom: h || "PCS",
                preferredSupplier: c,
                sourceSection: "Hardware Requirement",
                sourceRow: rowNumber,
            }, defaults);
        } else if (section === "POLISH_PAINT") {
            parsed = materialRow({
                materialName: b,
                category: "PAINT_POLISH",
                specification: [c && `Area ${c}`, d && `Coverage ${d}`, e && `Material Qty ${e}`, f && `Hardener ${f}`, g && `Thinner ${g}`].filter(Boolean).join(" · "),
                uom: "KG",
                preferredSupplier: h,
                sourceSection: "Polish/Paint Requirement",
                sourceRow: rowNumber,
            }, defaults);
        } else if (section === "FABRIC") {
            const quantityText = c || d;
            parsed = materialRow({
                materialName: b,
                category: categoryFromName(b, "FABRIC_LEATHER"),
                specification: quantityText || null,
                uom: c ? "SQFT" : d ? "MTR" : defaults.uom,
                sourceSection: "Fabric/Leather",
                sourceRow: rowNumber,
            }, defaults);
        }
        if (parsed) rows.push(parsed);
    });

    return rows;
};

export async function parseMaterialImportWorkbook(file, defaults = {}) {
    const config = {
        category: upper(defaults.category || "HARDWARE"),
        uom: upper(defaults.uom || "PCS"),
        codePrefix: upper(defaults.codePrefix || "MAT"),
    };
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    let rows = [];
    workbook.worksheets.forEach((sheet) => {
        const canonical = parseCanonicalTable(sheet, config);
        if (canonical.length) {
            rows.push(...canonical);
            return;
        }
        const firstColumnValues = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
            if (row.cellCount === 1 || (safeText(row.getCell(1).value) && row.cellCount <= 2)) {
                firstColumnValues.push(safeText(row.getCell(1).value));
            }
        });
        const nonEmptyRowCount = sheet.actualRowCount || firstColumnValues.length;
        if (firstColumnValues.length >= Math.max(3, Math.floor(nonEmptyRowCount * 0.8))) {
            rows.push(...parseOneColumnList(sheet, config));
        } else {
            rows.push(...parseAlsorgBomSheet(sheet, config));
        }
    });
    return dedupe(rows);
}

const asCell = (value) => {
    if (value == null) return "";
    if (value instanceof Date) return value;
    if (["string", "number", "boolean"].includes(typeof value)) return value;
    return JSON.stringify(value);
};


const matFlowExportKeyTokens = (key) =>
    safeText(key)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

/**
 * Frontend exports intentionally exclude legacy generic routing-node fields.
 * MatFlow operators work with Plant Store / Main Store / Processing Unit /
 * exact Production requester only; any old persistence field that contains a
 * standalone "location" or "custody" token must never leak into generated XLSX.
 */
const isPublicMatFlowExportKey = (key) => {
    const tokens = matFlowExportKeyTokens(key);
    if (tokens.includes("location") || tokens.includes("custody")) return false;
    const normalized = normalizeHeader(key);
    if (["transfers", "transfer orders", "internal transfers"].includes(normalized)) return false;
    return true;
};

const columnWidth = (header, rows, key) => {
    const max = Math.max(
        safeText(header).length,
        ...rows.slice(0, 500).map((row) => safeText(row?.[key]).length)
    );
    return Math.max(11, Math.min(38, max + 2));
};

export async function downloadMatFlowExcel({
    fileName,
    sheetName = "Data",
    title,
    subtitle = "",
    rows = [],
    columns = [],
    metadata = [],
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ALSORG FlowSuite / MatFlow";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(String(sheetName || "Data").slice(0, 31), {
        views: [{ state: "frozen", ySplit: 5 }],
    });

    const resolvedColumns = (columns.length
        ? columns
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))))
            .filter((key) => !["_raw"].includes(key))
            .map((key) => ({ key, label: key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ") })))
        .filter((column) => isPublicMatFlowExportKey(column?.key));

    const lastCol = Math.max(1, resolvedColumns.length);
    sheet.mergeCells(1, 1, 1, lastCol);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title || sheetName;
    titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 28;

    sheet.mergeCells(2, 1, 2, lastCol);
    sheet.getCell(2, 1).value = subtitle || `Exported ${new Date().toLocaleString("en-IN")}`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF475569" } };

    const metaText = metadata.filter(Boolean).join("  •  ");
    sheet.mergeCells(3, 1, 3, lastCol);
    sheet.getCell(3, 1).value = metaText;
    sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF64748B" } };

    const headerRow = sheet.getRow(5);
    resolvedColumns.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.label || column.key;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0369A1" } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { bottom: { style: "thin", color: { argb: "FF0EA5E9" } } };
    });
    headerRow.height = 24;

    rows.forEach((row, rowIndex) => {
        const target = sheet.getRow(6 + rowIndex);
        resolvedColumns.forEach((column, colIndex) => {
            target.getCell(colIndex + 1).value = asCell(
                typeof column.value === "function" ? column.value(row) : row?.[column.key]
            );
        });
        if (rowIndex % 2 === 1) {
            target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
    });

    resolvedColumns.forEach((column, index) => {
        sheet.getColumn(index + 1).width = column.width || columnWidth(column.label || column.key, rows, column.key);
    });
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: lastCol } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeText(fileName || sheetName || "MatFlow_Report").replace(/[^a-z0-9._-]+/gi, "_")}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}


const ALSORG_BOM_COMPANY_LINE = "Alsorg Interior's Pvt Ltd , Begumpur Khatola, Rectangle No.11,Kharsa No. 2 & 9, Behrampur Road,GGN (Haryana)";

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

const BOM_CATEGORY_ORDER = [
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

const BOM_CATEGORY_LABELS = {
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

const normalizeBomCategory = (value) => {
    const normalized = upper(value || "OTHER")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized || "OTHER";
};

const readableBomCategory = (value) =>
    normalizeBomCategory(value)
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const bomSectionLabel = (category) =>
    BOM_CATEGORY_LABELS[normalizeBomCategory(category)] || `${readableBomCategory(category)} Requirement`;

const numberForBom = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const splitBomSpecification = (value) => {
    const text = safeText(value);
    const result = { section: "", finish: "", size: "", thickness: "" };
    if (!text) return result;

    const parts = text
        .split(/\s*(?:\||•|·|;)\s*/)
        .map((part) => safeText(part))
        .filter(Boolean);

    let matched = false;
    const unlabelled = [];

    for (const part of parts.length ? parts : [text]) {
        const match = part.match(/^(section|finish|size|thk|thickness)\s*[:=\-]\s*(.+)$/i);
        if (!match) {
            unlabelled.push(part);
            continue;
        }
        matched = true;
        const key = match[1].toLowerCase();
        const payload = safeText(match[2]);
        if (key === "section") result.section = payload;
        else if (key === "finish") result.finish = payload;
        else if (key === "size") result.size = payload;
        else result.thickness = payload;
    }

    if (unlabelled.length) {
        const remainder = unlabelled.join(" · ");
        if (!result.size) result.size = remainder;
        else result.size = [result.size, remainder].filter(Boolean).join(" · ");
    } else if (!matched) {
        result.size = text;
    }

    return result;
};

const thinBlackBorder = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

const styleBomRangeBorder = (sheet, rowNumber) => {
    for (let col = 1; col <= 11; col += 1) {
        sheet.getCell(rowNumber, col).border = thinBlackBorder;
    }
};

const routesForBomLine = (routes, lineId) =>
    (Array.isArray(routes) ? routes : [])
        .filter((step) => String(step?.bomLineId ?? "") === String(lineId ?? ""))
        .filter((step) => normalizeBomCategory(step?.stepType) === "PROCESSING")
        .sort((a, b) => numberOr(a?.sequenceNo, 0) - numberOr(b?.sequenceNo, 0));

/**
 * Downloads one Product BOM in the ALSORG "Final Sparta BOM Format" supplied
 * for MatFlow. The company/address line, Material Requirement title, Project /
 * PD No. / Drawing Title / Estimate By rows, column order, widths, borders and
 * overall visual language intentionally mirror that workbook.
 *
 * The only structural difference requested for MatFlow is that materials are
 * rendered in a separate section for every material category instead of one
 * continuous list repeating the category in every row. The original
 * "Material Type" column is retained for format compatibility but is left
 * blank because the section heading itself is now the category authority.
 */
export async function downloadMatFlowBomExcel({ bom, routes = [] } = {}) {
    if (!bom || typeof bom !== "object") {
        throw new Error("A BOM is required for download.");
    }

    const project = bom.project || bom.projectDrawing || bom.projectContext || {};
    const lines = Array.isArray(bom.lines)
        ? bom.lines
        : Array.isArray(bom.bomLines)
            ? bom.bomLines
            : Array.isArray(bom.items)
                ? bom.items
                : [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ALSORG FlowSuite / MatFlow";
    workbook.lastModifiedBy = safeText(bom.updatedBy || bom.createdBy || "ALSORG");
    workbook.company = "ALSORG";
    workbook.title = safeText(bom.bomNumber || "ALSORG Material Requirement");
    workbook.subject = "Product Bill of Material / Material Requirement";
    workbook.category = "MatFlow BOM";
    workbook.description = "ALSORG MatFlow Product BOM in the approved Sparta Material Requirement format.";
    workbook.keywords = "ALSORG, MatFlow, BOM, Material Requirement";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet("BOM");
    sheet.properties.defaultRowHeight = 18;
    sheet.pageSetup.margins = {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
    };

    ALSORG_BOM_COLUMNS.forEach((column, index) => {
        sheet.getColumn(index + 1).width = column.width;
    });

    sheet.mergeCells("A1:K1");
    const companyCell = sheet.getCell("A1");
    companyCell.value = ALSORG_BOM_COMPANY_LINE;
    companyCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
    companyCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 20;
    styleBomRangeBorder(sheet, 1);

    sheet.mergeCells("A2:K2");
    const titleCell = sheet.getCell("A2");
    titleCell.value = "Material Requirement";
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF000000" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 26;
    for (let col = 1; col <= 11; col += 1) {
        sheet.getCell(2, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    }
    styleBomRangeBorder(sheet, 2);

    sheet.mergeCells("A3:F3");
    sheet.mergeCells("G3:J3");
    sheet.getCell("A3").value = `PROJECT :- ${safeText(project.projectName || "")}`;
    sheet.getCell("G3").value = `PD No. :- ${safeText(project.projectCode || project.pdNo || "-")}`;

    sheet.mergeCells("A4:F4");
    sheet.mergeCells("G4:J4");
    sheet.getCell("A4").value = `Drawing Title :- ${safeText(project.productName || project.drawingTitle || "-")}`;
    sheet.getCell("G4").value = `Estimate By :- ${safeText(bom.createdBy || bom.submittedBy || bom.updatedBy || "-")}`;

    for (const rowNumber of [3, 4]) {
        sheet.getRow(rowNumber).height = 20;
        for (let col = 1; col <= 11; col += 1) {
            const cell = sheet.getCell(rowNumber, col);
            cell.font = { name: "Calibri", size: 12, color: { argb: "FF000000" } };
            cell.alignment = { vertical: "middle", wrapText: true };
        }
        styleBomRangeBorder(sheet, rowNumber);
    }

    const grouped = new Map();
    lines.forEach((line) => {
        const key = normalizeBomCategory(
            line?.materialCategorySnapshot || line?.materialCategory || line?.category || "OTHER"
        );
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(line);
    });

    const categories = Array.from(grouped.keys()).sort((left, right) => {
        const leftIndex = BOM_CATEGORY_ORDER.indexOf(left);
        const rightIndex = BOM_CATEGORY_ORDER.indexOf(right);
        if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
        if (leftIndex >= 0) return -1;
        if (rightIndex >= 0) return 1;
        return readableBomCategory(left).localeCompare(readableBomCategory(right));
    });

    let rowNumber = 5;
    let serial = 1;

    const writeSectionHeader = (category) => {
        sheet.mergeCells(rowNumber, 1, rowNumber, 11);
        const cell = sheet.getCell(rowNumber, 1);
        cell.value = bomSectionLabel(category);
        cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        for (let col = 1; col <= 11; col += 1) {
            sheet.getCell(rowNumber, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
        }
        sheet.getRow(rowNumber).height = 22;
        styleBomRangeBorder(sheet, rowNumber);
        rowNumber += 1;
    };

    const writeColumnHeader = () => {
        ALSORG_BOM_COLUMNS.forEach((column, index) => {
            const cell = sheet.getCell(rowNumber, index + 1);
            cell.value = column.header;
            cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.border = thinBlackBorder;
        });
        sheet.getRow(rowNumber).height = 22;
        rowNumber += 1;
    };

    const writeMaterialRow = (line) => {
        const specification = splitBomSpecification(line?.specification || line?.specificationSnapshot);
        const processing = routesForBomLine(routes, line?.id)
            .map((step) => {
                const process = safeText(step?.processCode || "PROCESS");
                const unit = safeText(step?.processingUnitCode || step?.processingUnitName || "PROCESSING UNIT");
                return `${process} @ ${unit}`;
            })
            .filter(Boolean)
            .join(" | ");

        const remark = [
            safeText(line?.remarks),
            processing ? `Processing: ${processing}` : "",
        ].filter(Boolean).join(" | ");

        const qty = numberForBom(line?.netRequiredQty, numberForBom(line?.requiredQty, 0));
        const values = [
            serial,
            safeText(line?.materialName || line?.materialNameSnapshot),
            "",
            safeText(line?.materialCode || line?.materialCodeSnapshot),
            specification.section,
            specification.finish,
            specification.size,
            specification.thickness,
            safeText(line?.uom || line?.uomSnapshot),
            qty,
            remark,
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
        styleBomRangeBorder(sheet, rowNumber);
    } else {
        categories.forEach((category) => {
            writeSectionHeader(category);
            writeColumnHeader();
            (grouped.get(category) || [])
                .slice()
                .sort((a, b) => numberOr(a?.lineNo, 0) - numberOr(b?.lineNo, 0))
                .forEach(writeMaterialRow);
        });
    }

    const finalRow = Math.max(rowNumber, sheet.rowCount);
    sheet.pageSetup.printArea = `A1:K${finalRow}`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeText(bom.bomNumber || "ALSORG_Material_Requirement")
        .replace(/[^a-z0-9._-]+/gi, "_")}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export async function downloadMaterialImportTemplate() {
    return downloadMatFlowExcel({
        fileName: "ALSORG_Material_Catalogue_Import_Template",
        sheetName: "Materials",
        title: "ALSORG Material Catalogue — Import Template",
        subtitle: "Material catalogue only. Physical stock, minimum stock and reorder controls are maintained in Tally.",
        rows: [
            {
                materialName: "Natural White Ash Veneer",
                materialCode: "VNR-WHITE-ASH",
                category: "VENEER",
                uom: "SQFT",
                specification: "8x4 sheet · selected grain",
                preferredSupplier: "Example Supplier",
            },
        ],
        columns: [
            { key: "materialName", label: "Material Name" },
            { key: "materialCode", label: "Material Code" },
            { key: "category", label: "Category" },
            { key: "uom", label: "UOM" },
            { key: "specification", label: "Specification" },
            { key: "preferredSupplier", label: "Preferred Supplier / Brand" },
        ],
    });
}
