export const OPERATION_SOURCE = Object.freeze({
    DISPATCH_CHALLAN: "DISPATCH_CHALLAN",
    MANUAL_SHIFT: "MANUAL_SHIFT",
});

const normalizeText = (value) =>
    String(value || "")
        .trim()
        .toUpperCase();

const safeNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
};

/*
 * Handles backend LocalDateTime without accidentally
 * converting it from UTC.
 */
export function parseBusinessDateTime(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : value;
    }

    const raw =
        String(value).trim();

    if (!raw) {
        return null;
    }

    const hasTimezone =
        /z$/i.test(raw) ||
        /[+-]\d{2}:\d{2}$/.test(raw);

    if (!hasTimezone) {
        const match =
            raw.match(
                /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
            );

        if (match) {
            const date =
                new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3]),
                    Number(match[4]),
                    Number(match[5]),
                    Number(match[6] || 0)
                );

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }
    }

    const date =
        new Date(raw);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

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

export function getOperationDurationMinutes(
    startValue,
    endValue,
    storedDuration
) {
    const stored =
        Number(storedDuration);

    if (
        Number.isFinite(stored) &&
        stored >= 0
    ) {
        return stored;
    }

    const start =
        parseBusinessDateTime(startValue);

    const end =
        parseBusinessDateTime(endValue);

    if (!start || !end) {
        return null;
    }

    return Math.max(
        0,
        Math.round(
            (end.getTime() - start.getTime()) /
            60000
        )
    );
}

export function formatOperationDuration(minutes) {
    if (
        minutes === null ||
        minutes === undefined ||
        !Number.isFinite(Number(minutes))
    ) {
        return "—";
    }

    const total =
        Math.max(0, Number(minutes));

    const hours =
        Math.floor(total / 60);

    const remaining =
        Math.round(total % 60);

    if (hours === 0) {
        return `${remaining} min`;
    }

    return `${hours} hr ${remaining} min`;
}

function getDispatchStatus(challan) {
    const rawStatus =
        normalizeText(
            challan?.tripStatus
        );

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

    if (rawStatus === "CANCELLED") {
        return "CANCELLED";
    }

    return "RUNNING";
}

export function normalizeDispatchOperation(
    challan
) {
    const challanNumber =
        String(
            challan?.challanNumber || ""
        ).trim();

    const startAt =
        challan?.tripStartedAt ||
        challan?.dispatchedAt ||
        challan?.generatedAt ||
        null;

    const endAt =
        challan?.tripEndedAt ||
        null;

    return {
        key:
            `CHALLAN:${challanNumber}`,

        source:
            OPERATION_SOURCE.DISPATCH_CHALLAN,

        sourceLabel:
            "Dispatch Challan",

        recordId:
            challanNumber,

        title:
            challanNumber || "Dispatch Challan",

        challanNumber,

        driverName:
            challan?.driverName || "—",

        vehicleNumber:
            challan?.vehicleNumber || "—",

        startAt,
        endAt,

        durationMinutes:
            getOperationDurationMinutes(
                startAt,
                endAt,
                challan?.tripDurationMinutes
            ),

        status:
            getDispatchStatus(challan),

        itemCount:
            safeNumber(
                challan?.totalItems
            ),

        tripCount: 1,

        routeCategory:
            challan?.routeCategory || "Dispatch",

        dispatchedBy:
            challan?.dispatchedBy || "—",

        searchableText: [
            challanNumber,
            challan?.driverName,
            challan?.vehicleNumber,
            challan?.dispatchedBy,
            challan?.tripStatus,
            ...(challan?.items || []).flatMap(
                (item) => [
                    item?.name,
                    item?.sku,
                    item?.pdNo,
                    item?.drawingNo,
                    item?.clientName,
                    item?.description,
                    item?.plantCode,
                    item?.status,
                ]
            ),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),

        raw:
            challan,
    };
}

export function normalizeManualOperation(
    shift
) {
    const status =
        normalizeText(
            shift?.status || "WORKING"
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
        String(shift?.id || "");

    return {
        key:
            `SHIFT:${id}`,

        source:
            OPERATION_SOURCE.MANUAL_SHIFT,

        sourceLabel:
            "Manual / Legacy",

        recordId:
            shift?.id,

        title:
            id
                ? `Manual ${id.slice(0, 8).toUpperCase()}`
                : "Manual Operation",

        challanNumber: "",

        driverName:
            shift?.driver?.name ||
            shift?.driverName ||
            "—",

        vehicleNumber:
            shift?.vehicle?.vehicleNumber ||
            shift?.vehicleNumber ||
            "—",

        startAt,
        endAt,

        durationMinutes:
            getOperationDurationMinutes(
                startAt,
                endAt,
                shift?.totalWorkingHours != null
                    ? Number(
                        shift.totalWorkingHours
                    ) * 60
                    : null
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

        routeCategory:
            shift?.routeCategory || "—",

        searchableText: [
            shift?.driver?.name,
            shift?.vehicle?.vehicleNumber,
            shift?.routeCategory,
            shift?.remarks,
            shift?.status,
            shift?.totalTrips,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),

        raw:
            shift,
    };
}

export function buildUnifiedOperations(
    challans,
    shifts
) {
    const dispatchRows =
        (Array.isArray(challans)
            ? challans
            : []
        ).map(
            normalizeDispatchOperation
        );

    const manualRows =
        (Array.isArray(shifts)
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
                a.startAt
            );

        const bDate =
            parseBusinessDateTime(
                b.startAt
            );

        return (
            (bDate?.getTime() || 0) -
            (aDate?.getTime() || 0)
        );
    });
}

export function isActiveOperation(
    operation
) {
    return [
        "RUNNING",
        "WORKING",
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
        "CANCELLED",
    ].includes(
        normalizeText(
            operation?.status
        )
    );
}

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
        String(value).padStart(2, "0");

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-");
}