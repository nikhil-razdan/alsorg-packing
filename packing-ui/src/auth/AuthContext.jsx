import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import API from "../services/api";
import { normalizeRole } from "../utils/permissions";

const AuthContext = createContext(null);

const normalizeValues = (values) => {
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
	);
};

const clearCompatibilityStorage = () => {
	localStorage.removeItem("token");
	localStorage.removeItem("accessToken");
	localStorage.removeItem("currentUser");
	localStorage.removeItem("username");
	localStorage.removeItem("role");
	localStorage.removeItem("plantCode");
	localStorage.removeItem("plantCodes");
};

const persistCompatibilityUser = (user) => {
	if (!user) {
		clearCompatibilityStorage();
		return;
	}

	localStorage.setItem(
		"currentUser",
		JSON.stringify(user)
	);

	localStorage.setItem(
		"username",
		user.username || ""
	);

	localStorage.setItem(
		"role",
		user.role || ""
	);

	localStorage.setItem(
		"plantCode",
		user.plantCode || ""
	);

	localStorage.setItem(
		"plantCodes",
		JSON.stringify(
			user.plantCodes || []
		)
	);
};

const unwrapAuthResponse = (response) => {
	return (
		response?.data?.data ??
		response?.data ??
		{}
	);
};

export function AuthProvider({ children }) {
	const [user, setUserState] =
		useState(null);

	const [authLoading, setAuthLoading] =
		useState(true);

	const setUser = useCallback(
		(nextUser) => {
			const cleanUser =
				nextUser || null;

			setUserState(cleanUser);
			persistCompatibilityUser(
				cleanUser
			);
		},
		[]
	);

	const clearSession = useCallback(() => {
		setUserState(null);
		clearCompatibilityStorage();
	}, []);

	const loadMe = useCallback(async () => {
		setAuthLoading(true);

		try {
			const response =
				await API.get("/auth/me");

			const data =
				unwrapAuthResponse(response);

			if (
				data.authenticated !== true ||
				data.enabled !== true ||
				!data.id ||
				!String(
					data.username || ""
				).trim()
			) {
				clearSession();
				return null;
			}

			const cleanRole =
				normalizeRole(data.role);

			const primaryPlantCode =
				String(
					data.plantCode || ""
				)
					.trim()
					.toUpperCase();

			const plantCodes =
				normalizeValues([
					...(
						Array.isArray(
							data.plantCodes
						)
							? data.plantCodes
							: []
					),
					primaryPlantCode,
				]);

			const nextUser = {
				id: data.id,

				username:
					String(
						data.username || ""
					).trim(),

				role: cleanRole,

				enabled: true,

				warehouseAccess:
					data.warehouseAccess ===
					true ||
					cleanRole === "ADMIN" ||
					cleanRole === "WAREHOUSE",

				plantCode:
					primaryPlantCode ||
					plantCodes[0] ||
					"",

				plantCodes,

				modules:
					normalizeValues(
						data.modules
					),

				driverId:
					data.driverId || null,
			};

			setUser(nextUser);

			return nextUser;
		} catch {
			clearSession();
			return null;
		} finally {
			setAuthLoading(false);
		}
	}, [
		clearSession,
		setUser,
	]);

	useEffect(() => {
		loadMe();

		const onUnauthorized = () => {
			clearSession();
		};

		window.addEventListener(
			"app:unauthorized",
			onUnauthorized
		);

		return () => {
			window.removeEventListener(
				"app:unauthorized",
				onUnauthorized
			);
		};
	}, [
		clearSession,
		loadMe,
	]);

	const logout = useCallback(async () => {
		try {
			await API.post("/auth/logout");
		} catch {
			/*
			 * Local authentication state must still
			 * be cleared when the API is unavailable.
			 */
		}

		clearSession();
	}, [clearSession]);

	const value = useMemo(
		() => ({
			user,
			setUser,
			authLoading,

			isLoggedIn: Boolean(
				user?.id &&
				user?.enabled === true
			),

			role:
				user?.role || "",

			modules:
				user?.modules || [],

			plantCode:
				user?.plantCode || "",

			plantCodes:
				user?.plantCodes || [],

			warehouseAccess:
				Boolean(
					user?.warehouseAccess
				),

			loadMe,
			logout,
		}),
		[
			user,
			setUser,
			authLoading,
			loadMe,
			logout,
		]
	);

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context =
		useContext(AuthContext);

	if (!context) {
		throw new Error(
			"useAuth must be used inside AuthProvider"
		);
	}

	return context;
}