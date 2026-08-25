export const VEHICLE_DOCUMENT_WARNING_DAYS = 30;
export const VEHICLE_DOCUMENT_CRITICAL_DAYS = 7;


/*
 * These are the vehicle documents currently participating in
 * PackFlow fleet-compliance alerts.
 *
 * Do not add Tax / Permit / National Permit here unless the
 * business workflow explicitly requires those documents to
 * participate in Header compliance notifications.
 */
export const VEHICLE_DOCUMENTS = Object.freeze([
    {
        key: "FITNESS",
        label: "Fitness",
        field: "fitnessValidUpto",
    },

    {
        key: "INSURANCE",
        label: "Insurance",
        field: "insuranceValidUpto",
    },

    {
        key: "PUCC",
        label: "PUCC",
        field: "puccValidUpto",
    },
]);


/* =========================================================
   DATE HELPERS
   ========================================================= */

function buildValidatedLocalDate(
    year,
    month,
    day
) {
    const numericYear =
        Number(year);

    const numericMonth =
        Number(month);

    const numericDay =
        Number(day);

    if (
        !Number.isInteger(
            numericYear
        ) ||
        !Number.isInteger(
            numericMonth
        ) ||
        !Number.isInteger(
            numericDay
        )
    ) {
        return null;
    }

    if (
        numericMonth < 1 ||
        numericMonth > 12 ||
        numericDay < 1 ||
        numericDay > 31
    ) {
        return null;
    }

    const date =
        new Date(
            numericYear,
            numericMonth - 1,
            numericDay,
            0,
            0,
            0,
            0
        );

    /*
     * JavaScript normally rolls invalid dates forward:
     *
     * 31-Feb -> March
     *
     * Compliance dates must never silently change like that.
     */
    if (
        Number.isNaN(
            date.getTime()
        ) ||
        date.getFullYear() !==
            numericYear ||
        date.getMonth() !==
            numericMonth - 1 ||
        date.getDate() !==
            numericDay
    ) {
        return null;
    }

    return date;
}


function normalizeTwoDigitYear(
    yearValue
) {
    const text =
        String(
            yearValue ?? ""
        ).trim();

    if (!/^\d{2,4}$/.test(text)) {
        return null;
    }

    if (text.length === 4) {
        return Number(text);
    }

    const year =
        Number(text);

    /*
     * Keep the same convention used by the current vehicle form:
     *
     * 00 - 50 => 2000 - 2050
     * 51 - 99 => 1951 - 1999
     */
    return year > 50
        ? 1900 + year
        : 2000 + year;
}


const MONTH_LOOKUP = Object.freeze({
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    SEPT: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12,
});


/* =========================================================
   VEHICLE DATE PARSER
   ========================================================= */

export function parseVehicleDate(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (value instanceof Date) {
        if (
            Number.isNaN(
                value.getTime()
            )
        ) {
            return null;
        }

        return buildValidatedLocalDate(
            value.getFullYear(),
            value.getMonth() + 1,
            value.getDate()
        );
    }

    const raw =
        String(value)
            .trim();

    if (!raw) {
        return null;
    }

    /*
     * Backend LocalDate / ISO-style values:
     *
     * yyyy-MM-dd
     * yyyy-MM-ddTHH:mm:ss
     */
    const isoMatch =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/
        );

    if (isoMatch) {
        return buildValidatedLocalDate(
            Number(isoMatch[1]),
            Number(isoMatch[2]),
            Number(isoMatch[3])
        );
    }

    /*
     * Existing UI / imported display format:
     *
     * dd/MM/yy
     * dd/MM/yyyy
     * dd-MM-yy
     * dd-MM-yyyy
     */
    const numericDisplayMatch =
        raw.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/
        );

    if (numericDisplayMatch) {
        const year =
            normalizeTwoDigitYear(
                numericDisplayMatch[3]
            );

        if (year === null) {
            return null;
        }

        return buildValidatedLocalDate(
            year,
            Number(
                numericDisplayMatch[2]
            ),
            Number(
                numericDisplayMatch[1]
            )
        );
    }

    /*
     * Common historical format:
     *
     * 25-Aug-2026
     * 25 Aug 2026
     */
    const namedMonthMatch =
        raw.match(
            /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{2,4})$/
        );

    if (namedMonthMatch) {
        const monthText =
            String(
                namedMonthMatch[2]
            )
                .trim()
                .toUpperCase();

        const month =
            MONTH_LOOKUP[
                monthText
                    .slice(0, 4)
            ] ??
            MONTH_LOOKUP[
                monthText
                    .slice(0, 3)
            ];

        const year =
            normalizeTwoDigitYear(
                namedMonthMatch[3]
            );

        if (
            month === undefined ||
            year === null
        ) {
            return null;
        }

        return buildValidatedLocalDate(
            year,
            month,
            Number(
                namedMonthMatch[1]
            )
        );
    }

    /*
     * Compatibility fallback for old browser-readable values.
     */
    const parsed =
        new Date(raw);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return buildValidatedLocalDate(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate()
    );
}


/* =========================================================
   VEHICLE DATE FORMAT
   ========================================================= */

export function formatVehicleDate(
    value
) {
    const date =
        parseVehicleDate(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    ).format(date);
}


/* =========================================================
   VEHICLE AGE
   ========================================================= */

export function getVehicleAgeFromRegistration(
    registrationDate
) {
    const registered =
        parseVehicleDate(
            registrationDate
        );

    if (!registered) {
        return "—";
    }

    const now =
        new Date();

    const today =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0
        );

    if (registered > today) {
        return "0 months";
    }

    let years =
        today.getFullYear() -
        registered.getFullYear();

    let months =
        today.getMonth() -
        registered.getMonth();

    /*
     * The current month has not fully elapsed if today's date
     * is before the registration day.
     */
    if (
        today.getDate() <
        registered.getDate()
    ) {
        months -= 1;
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    years =
        Math.max(
            0,
            years
        );

    months =
        Math.max(
            0,
            months
        );

    if (years === 0) {
        return (
            `${months} month` +
            (
                months === 1
                    ? ""
                    : "s"
            )
        );
    }

    if (months === 0) {
        return (
            `${years} year` +
            (
                years === 1
                    ? ""
                    : "s"
            )
        );
    }

    return (
        `${years} year` +
        (
            years === 1
                ? ""
                : "s"
        ) +
        ` ${months} month` +
        (
            months === 1
                ? ""
                : "s"
        )
    );
}


/* =========================================================
   DAY-LEVEL CALCULATION
   ========================================================= */

/**
 * Convert a local calendar date into an integer-like UTC day
 * timestamp.
 *
 * This deliberately ignores clock time and timezone offset.
 * It prevents DST/timezone boundaries from producing 23-hour
 * or 25-hour "days" in date-only compliance calculations.
 */
function toCalendarDayUtc(
    date
) {
    return Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}


function startOfToday() {
    const now =
        new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
    );
}


function getCalendarDaysBetween(
    fromDate,
    toDate
) {
    const dayMs =
        24 *
        60 *
        60 *
        1000;

    return Math.round(
        (
            toCalendarDayUtc(
                toDate
            ) -
            toCalendarDayUtc(
                fromDate
            )
        ) /
        dayMs
    );
}


/* =========================================================
   DOCUMENT VALIDITY
   ========================================================= */

export function getVehicleDocumentValidity(
    value,
    {
        warningDays =
            VEHICLE_DOCUMENT_WARNING_DAYS,

        criticalDays =
            VEHICLE_DOCUMENT_CRITICAL_DAYS,
    } = {}
) {
    const expiryDate =
        parseVehicleDate(value);

    if (!expiryDate) {
        return {
            status:
                "MISSING",

            severity:
                "WARNING",

            daysRemaining:
                null,

            date:
                null,

            statusText:
                "Not recorded",

            alert:
                true,
        };
    }

    const safeWarningDays =
        Math.max(
            0,
            Number.isFinite(
                Number(warningDays)
            )
                ? Number(warningDays)
                : VEHICLE_DOCUMENT_WARNING_DAYS
        );

    const safeCriticalDays =
        Math.max(
            0,
            Number.isFinite(
                Number(criticalDays)
            )
                ? Number(criticalDays)
                : VEHICLE_DOCUMENT_CRITICAL_DAYS
        );

    const daysRemaining =
        getCalendarDaysBetween(
            startOfToday(),
            expiryDate
        );

    if (daysRemaining < 0) {
        const daysExpired =
            Math.abs(
                daysRemaining
            );

        return {
            status:
                "EXPIRED",

            severity:
                "DANGER",

            daysRemaining,

            date:
                expiryDate,

            statusText:
                `Expired ${daysExpired} day${
                    daysExpired === 1
                        ? ""
                        : "s"
                } ago`,

            alert:
                true,
        };
    }

    if (daysRemaining === 0) {
        return {
            status:
                "EXPIRES_TODAY",

            severity:
                "DANGER",

            daysRemaining,

            date:
                expiryDate,

            statusText:
                "Expires today",

            alert:
                true,
        };
    }

    if (
        daysRemaining <=
        safeCriticalDays
    ) {
        return {
            status:
                "CRITICAL",

            severity:
                "DANGER",

            daysRemaining,

            date:
                expiryDate,

            statusText:
                `Expires in ${daysRemaining} day${
                    daysRemaining === 1
                        ? ""
                        : "s"
                }`,

            alert:
                true,
        };
    }

    if (
        daysRemaining <=
        safeWarningDays
    ) {
        return {
            status:
                "EXPIRING_SOON",

            severity:
                "WARNING",

            daysRemaining,

            date:
                expiryDate,

            statusText:
                `Expires in ${daysRemaining} day${
                    daysRemaining === 1
                        ? ""
                        : "s"
                }`,

            alert:
                true,
        };
    }

    return {
        status:
            "VALID",

        severity:
            "OK",

        daysRemaining,

        date:
            expiryDate,

        statusText:
            `Valid for ${daysRemaining} day${
                daysRemaining === 1
                    ? ""
                    : "s"
            }`,

        alert:
            false,
    };
}


/* =========================================================
   VEHICLE COMPLIANCE SUMMARY
   ========================================================= */

export function getVehicleCompliance(
    vehicle
) {
    const documents =
        VEHICLE_DOCUMENTS.map(
            (definition) => {
                const value =
                    vehicle?.[
                        definition.field
                    ];

                const validity =
                    getVehicleDocumentValidity(
                        value
                    );

                return {
                    key:
                        definition.key,

                    documentLabel:
                        definition.label,

                    field:
                        definition.field,

                    value,

                    formattedDate:
                        formatVehicleDate(
                            value
                        ),

                    ...validity,
                };
            }
        );

    const expiredCount =
        documents.filter(
            (document) =>
                [
                    "EXPIRED",
                    "EXPIRES_TODAY",
                ].includes(
                    document.status
                )
        ).length;

    const criticalCount =
        documents.filter(
            (document) =>
                document.status ===
                "CRITICAL"
        ).length;

    const expiringSoonCount =
        documents.filter(
            (document) =>
                document.status ===
                "EXPIRING_SOON"
        ).length;

    const missingCount =
        documents.filter(
            (document) =>
                document.status ===
                "MISSING"
        ).length;

    const alertCount =
        documents.filter(
            (document) =>
                document.alert ===
                true
        ).length;

    const severity =
        (
            expiredCount > 0 ||
            criticalCount > 0
        )
            ? "DANGER"

            : (
                expiringSoonCount > 0 ||
                missingCount > 0
            )
                ? "WARNING"

                : "OK";

    return {
        documents,

        expiredCount,

        criticalCount,

        expiringSoonCount,

        missingCount,

        alertCount,

        severity,
    };
}


/* =========================================================
   HEADER / FLEET NOTIFICATIONS
   ========================================================= */

export function buildVehicleComplianceNotifications(
    vehicles = []
) {
    const safeVehicles =
        Array.isArray(vehicles)
            ? vehicles
            : [];

    const notifications = [];

    safeVehicles.forEach(
        (vehicle) => {
            const vehicleNumber =
                String(
                    vehicle
                        ?.vehicleNumber ||
                    "Unknown Vehicle"
                )
                    .trim() ||
                "Unknown Vehicle";

            const compliance =
                getVehicleCompliance(
                    vehicle
                );

            compliance
                .documents
                .filter(
                    (document) =>
                        document.alert
                )
                .forEach(
                    (document) => {
                        const daysRemaining =
                            document
                                .daysRemaining;

                        let priority;

                        if (
                            document.status ===
                            "EXPIRED"
                        ) {
                            priority =
                                1000 +
                                Math.abs(
                                    daysRemaining ||
                                    0
                                );
                        } else if (
                            document.status ===
                            "EXPIRES_TODAY"
                        ) {
                            priority = 950;
                        } else if (
                            document.status ===
                            "CRITICAL"
                        ) {
                            priority =
                                900 -
                                (
                                    daysRemaining ||
                                    0
                                );
                        } else if (
                            document.status ===
                            "EXPIRING_SOON"
                        ) {
                            priority =
                                700 -
                                (
                                    daysRemaining ||
                                    0
                                );
                        } else {
                            /*
                             * Missing validity date.
                             */
                            priority = 500;
                        }

                        const title =
                            document.status ===
                            "MISSING"
                                ? `${document.documentLabel} date missing • ${vehicleNumber}`

                                : `${document.documentLabel} ${
                                    document.status ===
                                    "EXPIRED"
                                        ? "expired"

                                        : document.status ===
                                            "EXPIRES_TODAY"
                                            ? "expires today"

                                            : "expiry alert"
                                } • ${vehicleNumber}`;

                        const message =
                            document.status ===
                            "MISSING"
                                ? `${document.documentLabel} validity date is not recorded for ${vehicleNumber}.`

                                : `${document.statusText} • Valid up to ${document.formattedDate}.`;

                        notifications.push({
                            id:
                                `VEHICLE:${
                                    vehicle?.id ||
                                    vehicleNumber
                                }:${document.key}`,

                            title,

                            message,

                            type:
                                `FLEET • ${document.documentLabel.toUpperCase()}`,

                            severity:
                                document.severity ===
                                "DANGER"
                                    ? "error"
                                    : "warning",

                            priority,

                            read:
                                false,

                            vehicleId:
                                vehicle?.id ||
                                "",

                            vehicleNumber,

                            documentKey:
                                document.key,

                            status:
                                document.status,

                            daysRemaining:
                                document.daysRemaining,
                        });
                    }
                );
        }
    );

    /*
     * Highest-risk compliance alert first.
     *
     * Stable secondary ordering makes equal-priority results
     * deterministic instead of jumping around between renders.
     */
    return notifications.sort(
        (a, b) => {
            const priorityDifference =
                b.priority -
                a.priority;

            if (
                priorityDifference !== 0
            ) {
                return priorityDifference;
            }

            return String(
                a.vehicleNumber || ""
            ).localeCompare(
                String(
                    b.vehicleNumber ||
                    ""
                )
            );
        }
    );
}