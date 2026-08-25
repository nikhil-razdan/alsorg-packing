export const OPERATION_SOURCE = Object.freeze({
    DISPATCH_CHALLAN: "DISPATCH_CHALLAN",
    MANUAL_SHIFT: "MANUAL_SHIFT",
});


/* =========================================================
   NORMALIZATION HELPERS
   ========================================================= */

const normalizeText = (value) =>
    String(value ?? "")
        .trim()
        .toUpperCase();


const cleanText = (value) =>
    String(value ?? "")
        .trim();


const safeNumber = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
};


const firstNonBlank = (...values) => {
    for (const value of values) {
        const text = cleanText(value);

        if (text) {
            return text;
        }
    }

    return "";
};


/* =========================================================
   BUSINESS DATE / TIME
   ========================================================= */

/**
 * Backend LocalDateTime values represent local business time.
 *
 * Important:
 * A value such as:
 *
 *     2026-08-25T14:30:00
 *
 * must NOT be interpreted as UTC and shifted by the browser.
 *
 * Values carrying a timezone/offset are allowed to use native
 * Date parsing because they explicitly declare their timezone.
 */
export function parseBusinessDateTime(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return null;
        }

        return new Date(value.getTime());
    }

    const raw =
        String(value)
            .trim();

    if (!raw) {
        return null;
    }

    /*
     * Explicit timezone:
     *
     * 2026-08-25T14:30:00Z
     * 2026-08-25T14:30:00+05:30
     * 2026-08-25T14:30:00+0530
     */
    const hasTimezone =
        /z$/i.test(raw) ||
        /[+-]\d{2}:?\d{2}$/.test(raw);

    if (hasTimezone) {
        const parsed =
            new Date(raw);

        return Number.isNaN(
            parsed.getTime()
        )
            ? null
            : parsed;
    }

    /*
     * Parse Spring LocalDate / LocalDateTime ourselves so it
     * remains local business time in the browser.
     *
     * Supports:
     *
     * yyyy-MM-dd
     * yyyy-MM-ddTHH:mm
     * yyyy-MM-dd HH:mm
     * yyyy-MM-ddTHH:mm:ss
     * yyyy-MM-ddTHH:mm:ss.SSS...
     */
    const localMatch =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
        );

    if (localMatch) {
        const year =
            Number(localMatch[1]);

        const month =
            Number(localMatch[2]);

        const day =
            Number(localMatch[3]);

        const hour =
            Number(localMatch[4] || 0);

        const minute =
            Number(localMatch[5] || 0);

        const second =
            Number(localMatch[6] || 0);

        const milliseconds =
            Number(
                String(
                    localMatch[7] || "0"
                )
                    .slice(0, 3)
                    .padEnd(3, "0")
            );

        const parsed =
            new Date(
                year,
                month - 1,
                day,
                hour,
                minute,
                second,
                milliseconds
            );

        /*
         * JavaScript silently rolls invalid dates:
         *
         * 2026-02-31 -> March
         *
         * Reject those instead.
         */
        const valid =
            !Number.isNaN(
                parsed.getTime()
            ) &&
            parsed.getFullYear() === year &&
            parsed.getMonth() ===
                month - 1 &&
            parsed.getDate() === day &&
            parsed.getHours() === hour &&
            parsed.getMinutes() ===
                minute &&
            parsed.getSeconds() ===
                second;

        return valid
            ? parsed
            : null;
    }

    /*
     * Last-resort compatibility fallback for older API values.
     */
    const fallback =
        new Date(raw);

    return Number.isNaN(
        fallback.getTime()
    )
        ? null
        : fallback;
}


/* =========================================================
   DISPLAY FORMATTERS
   ========================================================= */

export function formatOperationDateTime(value) {
    const date =
        parseBusinessDateTime(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",

            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }
    ).format(date);
}


/**
 * Resolve the operation duration.
 *
 * Important fix:
 *
 * Number(null) === 0
 *
 * The old implementation therefore treated a missing backend
 * duration as an actual duration of zero and never calculated
 * Start -> End.
 *
 * We now:
 *
 * 1. Use a positive stored duration when one exists.
 * 2. Otherwise calculate from Start -> End.
 * 3. Preserve an explicitly stored zero only when timestamps
 *    cannot provide a calculated duration.
 */
export function getOperationDurationMinutes(
    startValue,
    endValue,
    storedDuration
) {
    const hasStoredDuration =
        storedDuration !== null &&
        storedDuration !== undefined &&
        String(storedDuration).trim() !== "";

    const stored =
        hasStoredDuration
            ? Number(storedDuration)
            : null;

    if (
        Number.isFinite(stored) &&
        stored > 0
    ) {
        return stored;
    }

    const start =
        parseBusinessDateTime(
            startValue
        );

    const end =
        parseBusinessDateTime(
            endValue
        );

    if (start && end) {
        return Math.max(
            0,
            Math.round(
                (
                    end.getTime() -
                    start.getTime()
                ) /
                60000
            )
        );
    }

    /*
     * An explicitly stored zero is still respected when there
     * is no usable start/end pair.
     */
    if (
        hasStoredDuration &&
        Number.isFinite(stored) &&
        stored === 0
    ) {
        return 0;
    }

    return null;
}


export function formatOperationDuration(minutes) {
    if (
        minutes === null ||
        minutes === undefined ||
        !Number.isFinite(
            Number(minutes)
        )
    ) {
        return "—";
    }

    const total =
        Math.max(
            0,
            Math.round(
                Number(minutes)
            )
        );

    const hours =
        Math.floor(
            total / 60
        );

    const remaining =
        total % 60;

    if (hours === 0) {
        return `${remaining} min`;
    }

    if (remaining === 0) {
        return `${hours} hr`;
    }

    return `${hours} hr ${remaining} min`;
}


/* =========================================================
   DISPATCH CHALLAN HELPERS
   ========================================================= */

function getDispatchStatus(challan) {
    const rawStatus =
        normalizeText(
            challan?.tripStatus
        );

    /*
     * Cancellation must remain cancellation even if an unusual
     * historical record also contains an end timestamp.
     */
    if (rawStatus === "CANCELLED") {
        return "CANCELLED";
    }

    if (
        challan?.tripEndedAt ||
        [
            "ENDED",
            "COMPLETED",
            "DELIVERED",
        ].includes(rawStatus)
    ) {
        return "COMPLETED";
    }

    return "RUNNING";
}


function getDispatchItems(challan) {
    return Array.isArray(
        challan?.items
    )
        ? challan.items
        : [];
}


function getDispatchItemCount(
    challan
) {
    const explicit =
        Number(
            challan?.totalItems
        );

    if (
        Number.isFinite(explicit) &&
        explicit > 0
    ) {
        return explicit;
    }

    return getDispatchItems(
        challan
    ).length;
}


/* =========================================================
   NORMALIZE DISPATCH CHALLAN
   ========================================================= */

export function normalizeDispatchOperation(
    challan
) {
    const challanNumber =
        cleanText(
            challan?.challanNumber
        );

    const driverName =
        firstNonBlank(
            challan?.driverName,
            challan?.driver?.name
        ) || "—";

    const vehicleNumber =
        firstNonBlank(
            challan?.vehicleNumber,
            challan?.vehicle
                ?.vehicleNumber
        ) || "—";

    const startAt =
        challan?.tripStartedAt ||
        challan?.dispatchedAt ||
        challan?.generatedAt ||
        challan?.createdAt ||
        null;

    const endAt =
        challan?.tripEndedAt ||
        null;

    const items =
        getDispatchItems(
            challan
        );

    /*
     * Prefer challan number for the stable identifier.
     * Use backend id / timestamps only as defensive fallbacks
     * for malformed or historical records.
     */
    const recordIdentity =
        challanNumber ||
        cleanText(challan?.id) ||
        [
            driverName,
            vehicleNumber,
            cleanText(startAt),
        ]
            .filter(Boolean)
            .join(":") ||
        "UNKNOWN";

    const routeCategory =
        firstNonBlank(
            challan?.routeCategory,
            challan?.route
        ) || "Dispatch";

    return {
        key:
            `CHALLAN:${recordIdentity}`,

        source:
            OPERATION_SOURCE
                .DISPATCH_CHALLAN,

        sourceLabel:
            "Dispatch Challan",

        recordId:
            challanNumber ||
            challan?.id ||
            "",

        title:
            challanNumber ||
            "Dispatch Challan",

        challanNumber,

        driverName,

        vehicleNumber,

        startAt,

        endAt,

        durationMinutes:
            getOperationDurationMinutes(
                startAt,
                endAt,
                challan
                    ?.tripDurationMinutes
            ),

        status:
            getDispatchStatus(
                challan
            ),

        itemCount:
            getDispatchItemCount(
                challan
            ),

        tripCount: 1,

        helperCount:
            safeNumber(
                challan
                    ?.helperLoaderCount
            ),

        routeCategory,

        dispatchedBy:
            firstNonBlank(
                challan?.dispatchedBy,
                challan
                    ?.dispatchedByName
            ) || "—",

        searchableText: [
            challanNumber,

            driverName,

            vehicleNumber,

            challan
                ?.dispatchedBy,

            challan
                ?.dispatchedByName,

            challan
                ?.tripStatus,

            routeCategory,

            startAt,

            endAt,

            challan
                ?.helperLoaderCount,

            ...items.flatMap(
                (item) => [
                    item?.name,
                    item?.itemName,

                    item?.sku,

                    item?.pdNo,

                    item?.drawingNo,

                    item?.clientName,

                    item?.description,

                    item?.plantCode,

                    item?.status,

                    item?.packetNumber,
                ]
            ),
        ]
            .filter(
                (value) =>
                    value !== null &&
                    value !== undefined &&
                    String(value)
                        .trim() !== ""
            )
            .join(" ")
            .toLowerCase(),

        raw:
            challan,
    };
}


/* =========================================================
   NORMALIZE MANUAL / LEGACY OPERATION
   ========================================================= */

export function normalizeManualOperation(
    shift
) {
    const status =
        normalizeText(
            shift?.status ||
            "WORKING"
        );

    const startAt =
        shift?.shiftStart ||
        shift?.date ||
        shift?.createdAt ||
        null;

    const endAt =
        shift?.shiftEnd ||
        null;

    const id =
        cleanText(
            shift?.id
        );

    const driverName =
        firstNonBlank(
            shift?.driver?.name,
            shift?.driverName
        ) || "—";

    const vehicleNumber =
        firstNonBlank(
            shift
                ?.vehicle
                ?.vehicleNumber,

            shift?.vehicleNumber
        ) || "—";

    const totalWorkingHours =
        Number(
            shift?.totalWorkingHours
        );

    /*
     * Only use totalWorkingHours as a stored duration when it
     * actually contains a positive recorded duration.
     *
     * Many older/manual records default this field to zero.
     * A zero must not hide a perfectly usable Start -> End
     * duration.
     */
    const storedDurationMinutes =
        Number.isFinite(
            totalWorkingHours
        ) &&
        totalWorkingHours > 0
            ? totalWorkingHours * 60
            : null;

    const recordIdentity =
        id ||
        [
            driverName,
            vehicleNumber,
            cleanText(startAt),
        ]
            .filter(Boolean)
            .join(":") ||
        "UNKNOWN";

    const routeCategory =
        firstNonBlank(
            shift?.routeCategory,
            shift?.route
        ) || "—";

    return {
        key:
            `SHIFT:${recordIdentity}`,

        source:
            OPERATION_SOURCE
                .MANUAL_SHIFT,

        sourceLabel:
            "Manual / Legacy",

        recordId:
            shift?.id || "",

        title:
            id
                ? `Manual ${id
                    .slice(0, 8)
                    .toUpperCase()}`
                : "Manual Operation",

        challanNumber: "",

        driverName,

        vehicleNumber,

        startAt,

        endAt,

        durationMinutes:
            getOperationDurationMinutes(
                startAt,
                endAt,
                storedDurationMinutes
            ),

        status,

        itemCount: 0,

        tripCount:
            safeNumber(
                shift?.totalTrips
            ),

        helperCount:
            safeNumber(
                shift?.totalLoaders ??
                shift?.totalHelpers
            ),

        fuelUsed:
            safeNumber(
                shift?.fuelUsed
            ),

        totalDistance:
            safeNumber(
                shift?.totalDistance
            ),

        overtimeHours:
            safeNumber(
                shift?.overtimeHours
            ),

        routeCategory,

        searchableText: [
            driverName,

            vehicleNumber,

            shift?.routeCategory,

            shift?.route,

            shift?.remarks,

            shift?.status,

            shift?.totalTrips,

            shift?.totalHelpers,

            shift?.totalLoaders,

            shift?.fuelUsed,

            shift?.totalDistance,

            shift?.overtimeHours,

            startAt,

            endAt,
        ]
            .filter(
                (value) =>
                    value !== null &&
                    value !== undefined &&
                    String(value)
                        .trim() !== ""
            )
            .join(" ")
            .toLowerCase(),

        raw:
            shift,
    };
}


/* =========================================================
   BUILD UNIFIED OPERATION LIST
   ========================================================= */

export function buildUnifiedOperations(
    challans,
    shifts
) {
    const dispatchRows =
        (
            Array.isArray(challans)
                ? challans
                : []
        ).map(
            normalizeDispatchOperation
        );

    const manualRows =
        (
            Array.isArray(shifts)
                ? shifts
                : []
        ).map(
            normalizeManualOperation
        );

    return [
        ...dispatchRows,
        ...manualRows,
    ].sort((a, b) => {
        const aDate =
            parseBusinessDateTime(
                a?.startAt
            );

        const bDate =
            parseBusinessDateTime(
                b?.startAt
            );

        const aTime =
            aDate?.getTime() || 0;

        const bTime =
            bDate?.getTime() || 0;

        if (bTime !== aTime) {
            return bTime - aTime;
        }

        return String(
            a?.title || ""
        ).localeCompare(
            String(
                b?.title || ""
            )
        );
    });
}


/* =========================================================
   STATUS HELPERS
   ========================================================= */

export function isActiveOperation(
    operation
) {
    return [
        "RUNNING",
        "WORKING",
        "ACTIVE",
        "OUT_FOR_DELIVERY",
    ].includes(
        normalizeText(
            operation?.status
        )
    );
}


export function isCompletedOperation(
    operation
) {
    return [
        "COMPLETED",
        "ENDED",
        "DELIVERED",
        "CANCELLED",
    ].includes(
        normalizeText(
            operation?.status
        )
    );
}


/* =========================================================
   DATE KEY
   ========================================================= */

export function getOperationDateKey(
    operation
) {
    const date =
        parseBusinessDateTime(
            operation?.startAt
        );

    if (!date) {
        return "";
    }

    const pad = (value) =>
        String(value)
            .padStart(2, "0");

    return [
        date.getFullYear(),

        pad(
            date.getMonth() + 1
        ),

        pad(
            date.getDate()
        ),
    ].join("-");
}