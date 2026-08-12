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
    minimumStock = 0,
    reorderLevel = 0,
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
        minimumStock: numberOr(minimumStock, 0),
        reorderLevel: numberOr(reorderLevel, 0),
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
    const minIdx = indexOfAny("minimum stock", "min stock", "minimum");
    const reorderIdx = indexOfAny("reorder level", "reorder", "re order");

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
            minimumStock: minIdx >= 0 ? cellText(row, minIdx + 1) : 0,
            reorderLevel: reorderIdx >= 0 ? cellText(row, reorderIdx + 1) : 0,
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

    const resolvedColumns = columns.length
        ? columns
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))))
            .filter((key) => !["_raw"].includes(key))
            .map((key) => ({ key, label: key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ") }));

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

export async function downloadMaterialImportTemplate() {
    return downloadMatFlowExcel({
        fileName: "ALSORG_Global_Material_Inventory_Import_Template",
        sheetName: "Materials",
        title: "ALSORG Global Material Inventory — Import Template",
        subtitle: "Material Name is the primary identity shown to users. Material Code remains the unique business identifier.",
        rows: [
            {
                materialName: "Natural White Ash Veneer",
                materialCode: "VNR-WHITE-ASH",
                category: "VENEER",
                uom: "SQFT",
                specification: "8x4 sheet · selected grain",
                preferredSupplier: "Example Supplier",
                minimumStock: 100,
                reorderLevel: 150,
            },
        ],
        columns: [
            { key: "materialName", label: "Material Name" },
            { key: "materialCode", label: "Material Code" },
            { key: "category", label: "Category" },
            { key: "uom", label: "UOM" },
            { key: "specification", label: "Specification" },
            { key: "preferredSupplier", label: "Preferred Supplier / Brand" },
            { key: "minimumStock", label: "Minimum Stock" },
            { key: "reorderLevel", label: "Reorder Level" },
        ],
    });
}
