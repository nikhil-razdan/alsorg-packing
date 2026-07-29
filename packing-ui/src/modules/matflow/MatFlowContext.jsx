import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const MatFlowContext =
    createContext(null);

const STORAGE_KEY =
    "matflowSelectedPlant";

const ALL_PLANTS =
    "ALL";

const normalizePlants = (values) => {
    if (!Array.isArray(values)) {
        return [];
    }

    return Array.from(
        new Set(
            values
                .map((value) =>
                    String(value || "")
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    ).sort();
};

export function MatFlowProvider({
    children,
}) {
    const {
        plantCode,
        plantCodes,
    } = useAuth();

    const availablePlants =
        useMemo(() => {
            return normalizePlants([
                ...(
                    Array.isArray(
                        plantCodes
                    )
                        ? plantCodes
                        : []
                ),
                plantCode,
            ]);
        }, [
            plantCode,
            plantCodes,
        ]);

    const [
        selectedPlantCode,
        setSelectedPlantState,
    ] = useState(() => {
        return (
            localStorage.getItem(
                STORAGE_KEY
            ) || ALL_PLANTS
        );
    });

    useEffect(() => {
        if (
            selectedPlantCode ===
            ALL_PLANTS
        ) {
            return;
        }

        if (
            !availablePlants.includes(
                selectedPlantCode
            )
        ) {
            setSelectedPlantState(
                ALL_PLANTS
            );

            localStorage.setItem(
                STORAGE_KEY,
                ALL_PLANTS
            );
        }
    }, [
        availablePlants,
        selectedPlantCode,
    ]);

    const setSelectedPlantCode =
        useCallback(
            (nextValue) => {
                const normalized =
                    String(
                        nextValue ||
                        ALL_PLANTS
                    )
                        .trim()
                        .toUpperCase();

                const acceptedValue =
                    normalized ===
                        ALL_PLANTS ||
                        availablePlants.includes(
                            normalized
                        )
                        ? normalized
                        : ALL_PLANTS;

                setSelectedPlantState(
                    acceptedValue
                );

                localStorage.setItem(
                    STORAGE_KEY,
                    acceptedValue
                );
            },
            [availablePlants]
        );

    const value = useMemo(
        () => ({
            availablePlants,

            selectedPlantCode,

            selectedPlantParam:
                selectedPlantCode ===
                    ALL_PLANTS
                    ? undefined
                    : selectedPlantCode,

            allPlantsSelected:
                selectedPlantCode ===
                ALL_PLANTS,

            setSelectedPlantCode,
        }),
        [
            availablePlants,
            selectedPlantCode,
            setSelectedPlantCode,
        ]
    );

    return (
        <MatFlowContext.Provider value={value}>
            {children}
        </MatFlowContext.Provider>
    );
}

export function useMatFlow() {
    const context =
        useContext(MatFlowContext);

    if (!context) {
        throw new Error(
            "useMatFlow must be used inside MatFlowProvider"
        );
    }

    return context;
}