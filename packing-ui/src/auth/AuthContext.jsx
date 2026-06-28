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

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [authLoading, setAuthLoading] = useState(true);

	const loadMe = useCallback(async () => {
		try {
			const res = await API.get("/auth/me");
			const data = res.data || {};

			setUser({
				id: data.id,
				username: data.username || "",
				role: normalizeRole(data.role),
				enabled: data.enabled === true,
				warehouseAccess:
					data.warehouseAccess === true ||
					normalizeRole(data.role) === "ADMIN" ||
					normalizeRole(data.role) === "WAREHOUSE",
				plantCode: data.plantCode || "",
				plantCodes: Array.isArray(data.plantCodes)
					? data.plantCodes
					: [],
				modules: Array.isArray(data.modules)
					? data.modules
					: [],
				driverId: data.driverId || null,
			});
		} catch {
			setUser(null);
		} finally {
			setAuthLoading(false);
		}
	}, []);

	useEffect(() => {
		loadMe();

		const onUnauthorized = () => {
			setUser(null);
		};

		window.addEventListener("app:unauthorized", onUnauthorized);

		return () => {
			window.removeEventListener("app:unauthorized", onUnauthorized);
		};
	}, [loadMe]);

	const logout = useCallback(async () => {
		try {
			await API.post("/auth/logout");
		} catch {
			// ignore
		}

		setUser(null);
	}, []);

	const value = useMemo(
		() => ({
			user,
			setUser,
			authLoading,
			isLoggedIn: Boolean(user),
			role: user?.role || "",
			modules: user?.modules || [],
			plantCodes: user?.plantCodes || [],
			warehouseAccess: Boolean(user?.warehouseAccess),
			loadMe,
			logout,
		}),
		[
			user,
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
	const ctx = useContext(AuthContext);

	if (!ctx) {
		throw new Error("useAuth must be used inside AuthProvider");
	}

	return ctx;
}