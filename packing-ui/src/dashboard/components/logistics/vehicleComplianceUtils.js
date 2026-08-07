export const VEHICLE_DOCUMENT_WARNING_DAYS = 30;
export const VEHICLE_DOCUMENT_CRITICAL_DAYS = 7;

export const VEHICLE_DOCUMENTS = [
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
];

export function parseVehicleDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : new Date(
                value.getFullYear(),
                value.getMonth(),
                value.getDate()
            );
    }

    const raw =
        String(value).trim();

    if (!raw) return null;

    const match =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

    if (match) {
        const date =
            new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]),
                0,
                0,
                0,
                0
            );

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    const parsed =
        new Date(raw);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
        0,
        0,
        0,
        0
    );
}

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
            now.getDate()
        );

    if (
        registered > today
    ) {
        return "0 months";
    }

    let years =
        today.getFullYear() -
        registered.getFullYear();

    let months =
        today.getMonth() -
        registered.getMonth();

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
        return `${months} month${months === 1
                ? ""
                : "s"
            }`;
    }

    if (months === 0) {
        return `${years} year${years === 1
                ? ""
                : "s"
            }`;
    }

    return `${years} year${years === 1
            ? ""
            : "s"
        } ${months} month${months === 1
            ? ""
            : "s"
        }`;
}

function startOfToday() {
    const now =
        new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

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
            status: "MISSING",
            severity: "WARNING",
            daysRemaining: null,
            date: null,
            statusText:
                "Not recorded",
            alert: true,
        };
    }

    const dayMs =
        24 *
        60 *
        60 *
        1000;

    const daysRemaining =
        Math.round(
            (
                expiryDate.getTime() -
                startOfToday().getTime()
            ) /
            dayMs
        );

    if (
        daysRemaining < 0
    ) {
        const daysExpired =
            Math.abs(
                daysRemaining
            );

        return {
            status: "EXPIRED",
            severity: "DANGER",
            daysRemaining,
            date: expiryDate,
            statusText:
                `Expired ${daysExpired} day${daysExpired === 1
                    ? ""
                    : "s"
                } ago`,
            alert: true,
        };
    }

    if (
        daysRemaining === 0
    ) {
        return {
            status:
                "EXPIRES_TODAY",
            severity: "DANGER",
            daysRemaining,
            date: expiryDate,
            statusText:
                "Expires today",
            alert: true,
        };
    }

    if (
        daysRemaining <=
        criticalDays
    ) {
        return {
            status: "CRITICAL",
            severity: "DANGER",
            daysRemaining,
            date: expiryDate,
            statusText:
                `Expires in ${daysRemaining} day${daysRemaining === 1
                    ? ""
                    : "s"
                }`,
            alert: true,
        };
    }

    if (
        daysRemaining <=
        warningDays
    ) {
        return {
            status:
                "EXPIRING_SOON",
            severity: "WARNING",
            daysRemaining,
            date: expiryDate,
            statusText:
                `Expires in ${daysRemaining} days`,
            alert: true,
        };
    }

    return {
        status: "VALID",
        severity: "OK",
        daysRemaining,
        date: expiryDate,
        statusText:
            `Valid for ${daysRemaining} days`,
        alert: false,
    };
}

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
                document.alert
        ).length;

    const severity =
        expiredCount > 0 ||
            criticalCount > 0
            ? "DANGER"
            : expiringSoonCount >
                0 ||
                missingCount > 0
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

export function buildVehicleComplianceNotifications(
    vehicles = []
) {
    const notifications = [];

    vehicles.forEach(
        (vehicle) => {
            const vehicleNumber =
                String(
                    vehicle
                        ?.vehicleNumber ||
                    "Unknown Vehicle"
                ).trim() ||
                "Unknown Vehicle";

            getVehicleCompliance(
                vehicle
            )
                .documents
                .filter(
                    (document) =>
                        document.alert
                )
                .forEach(
                    (document) => {
                        const priority =
                            document.status ===
                                "EXPIRED"
                                ? 1000 +
                                Math.abs(
                                    document
                                        .daysRemaining ||
                                    0
                                )

                                : document.status ===
                                    "EXPIRES_TODAY"
                                    ? 950

                                    : document.status ===
                                        "CRITICAL"
                                        ? 900 -
                                        (
                                            document
                                                .daysRemaining ||
                                            0
                                        )

                                        : document.status ===
                                            "EXPIRING_SOON"
                                            ? 700 -
                                            (
                                                document
                                                    .daysRemaining ||
                                                0
                                            )

                                            : 500;

                        notifications.push(
                            {
                                id:
                                    `VEHICLE:${vehicle?.id ||
                                    vehicleNumber
                                    }:${document.key
                                    }`,

                                title:
                                    document.status ===
                                        "MISSING"
                                        ? `${document.documentLabel} date missing • ${vehicleNumber}`

                                        : `${document.documentLabel} ${document.status ===
                                            "EXPIRED"
                                            ? "expired"

                                            : document.status ===
                                                "EXPIRES_TODAY"
                                                ? "expires today"

                                                : "expiry alert"
                                        } • ${vehicleNumber}`,

                                message:
                                    document.status ===
                                        "MISSING"
                                        ? `${document.documentLabel} validity date is not recorded for ${vehicleNumber}.`

                                        : `${document.statusText} • Valid up to ${document.formattedDate}.`,

                                type:
                                    `FLEET • ${document.documentLabel.toUpperCase()}`,

                                severity:
                                    document.severity ===
                                        "DANGER"
                                        ? "error"
                                        : "warning",

                                priority,

                                read: false,

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
                            }
                        );
                    }
                );
        }
    );

    return notifications.sort(
        (a, b) =>
            b.priority -
            a.priority
    );
}