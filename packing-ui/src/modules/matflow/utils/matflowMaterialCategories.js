export const MATFLOW_MATERIAL_CATEGORIES =
    Object.freeze([
        {
            value: "METAL",
            label: "Metal",
            color: "#60a5fa",
        },
        {
            value: "WOOD",
            label: "Wood",
            color: "#8b5cf6",
        },
        {
            value: "HARDWARE",
            label: "Hardware",
            color: "#f59e0b",
        },
        {
            value: "STONE",
            label: "Stone",
            color: "#14b8a6",
        },
        {
            value: "GLASS",
            label: "Glass / Mirror",
            color: "#38bdf8",
        },
        {
            value: "UPHOLSTERY",
            label: "Upholstery",
            color: "#ec4899",
        },
        {
            value: "PAINT",
            label: "Paint / Polish",
            color: "#f472b6",
        },
        {
            value: "LAMINATE",
            label: "Laminate",
            color: "#a78bfa",
        },
        {
            value: "VENEER",
            label: "Veneer",
            color: "#c084fc",
        },
        {
            value: "ADHESIVE",
            label: "Adhesive",
            color: "#fb923c",
        },
        {
            value: "ELECTRICAL",
            label: "Electrical",
            color: "#facc15",
        },
        {
            value: "PACKAGING",
            label: "Packaging",
            color: "#22c55e",
        },
        {
            value: "CONSUMABLE",
            label: "Consumable",
            color: "#2dd4bf",
        },
        {
            value: "MISCELLANEOUS",
            label: "Miscellaneous",
            color: "#94a3b8",
        },
    ]);

const CATEGORY_MAP =
    new Map(
        MATFLOW_MATERIAL_CATEGORIES.map(
            (category, index) => [
                category.value,
                {
                    ...category,
                    order: index,
                },
            ]
        )
    );

export const normalizeMatFlowCategory = (
    value
) => {
    const normalized =
        String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

    return normalized ||
        "MISCELLANEOUS";
};

const titleCase = (value) => {
    return String(value || "")
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(
            /\b[a-z]/g,
            (letter) =>
                letter.toUpperCase()
        );
};

export const getMatFlowCategoryMeta = (
    value
) => {
    const normalized =
        normalizeMatFlowCategory(
            value
        );

    return (
        CATEGORY_MAP.get(normalized) || {
            value: normalized,
            label: titleCase(normalized),
            color: "#94a3b8",
            order: 999,
        }
    );
};