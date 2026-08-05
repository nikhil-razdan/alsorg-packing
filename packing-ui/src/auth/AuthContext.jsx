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

const normalizeRoles = (values) => {
	const source =
		Array.isArray(values)
			? values
			: values
				? [values]
				: [];

	return Array.from(
		new Set(
			source
				.map((value) =>
					normalizeRole(value)
				)
				.filter(Boolean)
		)
	);
};

const modulesForRoles = (roles) => {
	const cleanRoles =
		normalizeRoles(roles);

	if (cleanRoles.includes("ADMIN")) {
		return [
			"PACKFLOW",
			"BOMFLOW",
			"MATFLOW",
		];
	}

	const modules =
		new Set();

	cleanRoles.forEach((role) => {
		if (
			[
				"PACKING",
				"HARDWARE_PACKING",
				"WAREHOUSE",
				"DISPATCH",
				"LOGISTICS",
				"DRIVER",
			].includes(role)
		) {
			modules.add("PACKFLOW");
		}

		if (
			role.startsWith(
				"BOMFLOW_"
			)
		) {
			modules.add("BOMFLOW");
		}

		if (
			role.startsWith(
				"MATFLOW_"
			)
		) {
			modules.add("MATFLOW");
		}
	});

	return Array.from(modules);
};

const clearCompatibilityStorage = () => {
	localStorage.removeItem("token");
	localStorage.removeItem("jwt");
	localStorage.removeItem("accessToken");

	localStorage.removeItem("currentUser");
	localStorage.removeItem("username");

	localStorage.removeItem("role");
	localStorage.removeItem("roles");

	localStorage.removeItem("modules");

	localStorage.removeItem("plantCode");
	localStorage.removeItem("plantCodes");

	localStorage.removeItem(
		"warehouseAccess"
	);

	localStorage.removeItem(
		"driverId"
	);
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
		"roles",
		JSON.stringify(
			user.roles || []
		)
	);

	localStorage.setItem(
		"modules",
		JSON.stringify(
			user.modules || []
		)
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

	localStorage.setItem(
		"warehouseAccess",
		String(
			user.warehouseAccess ===
			true
		)
	);

	localStorage.setItem(
		"driverId",
		user.driverId || ""
	);
};

const unwrapAuthResponse = (response) => {
	return (
		response?.data?.data ??
		response?.data ??
		{}
	);
};

export function AuthProvider({
	children,
}) {
	const [user, setUserState] =
		useState(null);

	const [
		authLoading,
		setAuthLoading,
	] = useState(true);

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

	const clearSession = useCallback(
		() => {
			setUserState(null);
			clearCompatibilityStorage();
		},
		[]
	);

	const loadMe = useCallback(
		async () => {
			setAuthLoading(true);

			try {
				const response =
					await API.get(
						"/auth/me"
					);

				const data =
					unwrapAuthResponse(
						response
					);

				if (
					data.authenticated !==
					true ||
					data.enabled !== true ||
					data.id == null ||
					!String(
						data.username || ""
					).trim()
				) {
					clearSession();
					return null;
				}

				const legacyRole =
					normalizeRole(
						data.role
					);

				const roles =
					normalizeRoles([
						...(
							Array.isArray(
								data.roles
							)
								? data.roles
								: []
						),
						legacyRole,
					]);

				const cleanRole =
					legacyRole &&
						roles.includes(
							legacyRole
						)
						? legacyRole
						: roles[0] || "";

				if (
					!cleanRole ||
					roles.length === 0
				) {
					clearSession();
					return null;
				}

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

				const responseModules =
					normalizeValues(
						data.modules
					);

				const modules =
					responseModules.length > 0
						? responseModules
						: modulesForRoles(
							roles
						);

				const warehouseAccess =
					data.warehouseAccess ===
					true ||
					roles.includes(
						"ADMIN"
					) ||
					roles.includes(
						"WAREHOUSE"
					) ||
					roles.includes(
						"DISPATCH"
					);

				const nextUser = {
					id: data.id,

					username:
						String(
							data.username ||
							""
						).trim(),

					/*
					 * Primary compatibility role.
					 */
					role:
						cleanRole,

					/*
					 * Full effective role list.
					 */
					roles,

					enabled: true,

					warehouseAccess,

					plantCode:
						primaryPlantCode ||
						plantCodes[0] ||
						"",

					plantCodes,

					modules,

					driverId:
						data.driverId ||
						null,
				};

				setUser(nextUser);

				return nextUser;
			} catch {
				clearSession();
				return null;
			} finally {
				setAuthLoading(false);
			}
		},
		[
			clearSession,
			setUser,
		]
	);

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

	const logout = useCallback(
		async () => {
			try {
				await API.post(
					"/auth/logout"
				);
			} catch {
				/*
				 * Local authentication state must still
				 * be cleared if the API is unavailable.
				 */
			}

			clearSession();
		},
		[clearSession]
	);

	const value = useMemo(
		() => {
			const roles =
				Array.isArray(user?.roles)
					? user.roles
					: [];

			const hasRole = (
				requestedRole
			) => {
				const cleanRequestedRole =
					normalizeRole(
						requestedRole
					);

				return roles.includes(
					cleanRequestedRole
				);
			};

			const hasAnyRole = (
				...requestedRoles
			) => {
				return requestedRoles
					.flat()
					.some((requestedRole) =>
						hasRole(requestedRole)
					);
			};

			return {
				user,

				/*
				 * Compatibility alias for older pages.
				 */
				currentUser: user,

				setUser,
				authLoading,

				isLoggedIn: Boolean(
					user?.id &&
					user?.enabled === true
				),

				/*
				 * Primary legacy role.
				 */
				role:
					user?.role || "",

				/*
				 * Complete effective roles.
				 */
				roles,

				hasRole,
				hasAnyRole,

				username:
					user?.username || "",

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

				driverId:
					user?.driverId ||
					null,

				loadMe,
				logout,
			};
		},
		[
			user,
			setUser,
			authLoading,
			loadMe,
			logout,
		]
	);

	return (
		<AuthContext.Provider
			value={value}
		>
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