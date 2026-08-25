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

/*
 * HRFLOW PUBLIC-PORTAL IMPORTS
 *
 * These are used only when the browser is opened directly on:
 *   /hr/apply/{token}
 *   /hr/onboarding/{token}
 *
 * AuthProvider intercepts those two exact public flows before the ordinary
 * FlowSuite router/authenticated application is rendered. All ordinary
 * FlowSuite routes continue through the unchanged authentication path below.
 */
import HrCandidateApplicationPage from "../modules/hrflow/HrCandidateApplicationPage";
import HrOnboardingPortalPage from "../modules/hrflow/HrOnboardingPortalPage";
import { HrFlowThemeProvider } from "../modules/hrflow/HrFlowCommon";
import MachFlowRequestPortal from "../modules/machflow/MachFlowRequestPortal";

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
			"MACHFLOW",
			"MATERIALS",
			"CLIENTS",
			"HRFLOW",
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
			modules.add("MATERIALS");
		}

		if (
			role.startsWith(
				"MACHFLOW_"
			)
		) {
			modules.add("MACHFLOW");
		}

		/*
		 * HRFlow normally uses its own /hrflow/me grant check. This fallback
		 * only helps installations that also expose HR roles through /auth/me.
		 */
		if (
			role.startsWith("HRFLOW_") ||
			role.startsWith("HR_") ||
			role === "RECRUITER"
		) {
			modules.add("HRFLOW");
		}
	});

	return Array.from(modules);
};

const clearCompatibilityStorage = () => {
	localStorage.removeItem("token");
	localStorage.removeItem("authToken");
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

/*
 * Reads only the two HRFlow token portals.
 *
 * It supports:
 *   /hr/apply/{token}
 *   /hr/onboarding/{token}
 *
 * It also tolerates a deployment basename before /hr and HashRouter-style
 * URLs such as #/hr/apply/{token}. It deliberately does NOT treat the
 * authenticated internal HR module (/modules?module=hrflow) as public.
 */
const resolveHrPublicPortal = () => {
	if (typeof window === "undefined") {
		return null;
	}

	const sources = [
		String(window.location.pathname || ""),
		String(window.location.hash || "").replace(/^#/, ""),
	];

	for (const source of sources) {
		const path = source
			.split("?")[0]
			.replace(/\/+/g, "/");

		const parts = path
			.split("/")
			.filter(Boolean);

		const hrIndex = parts.findIndex(
			(part) =>
				String(part || "")
					.toLowerCase() === "hr"
		);

		if (hrIndex < 0) {
			continue;
		}

		const mode = String(
			parts[hrIndex + 1] || ""
		).toLowerCase();

		if (
			mode !== "apply" &&
			mode !== "onboarding"
		) {
			continue;
		}

		const encodedToken = parts
			.slice(hrIndex + 2)
			.join("/")
			.trim();

		if (!encodedToken) {
			continue;
		}

		let rawToken = encodedToken;

		try {
			rawToken =
				decodeURIComponent(
					encodedToken
				);
		} catch {
			/*
			 * Base64URL tokens normally need no decoding.
			 * Keep the original value if a malformed percent sequence exists.
			 */
		}

		return {
			mode,
			token: rawToken,
		};
	}

	return null;
};

/*
 * Standalone MachFlow request center.
 *
 * This route is intentionally available before the authenticated FlowSuite
 * router because approved non-FlowSuite employees may use Reporter Passes.
 * The backend still requires Reporter Code + PIN before it accepts a post.
 */
const resolveMachFlowPublicPortal = () => {
	if (typeof window === "undefined") {
		return false;
	}

	const sources = [
		String(window.location.pathname || ""),
		String(window.location.hash || "").replace(/^#/, ""),
	];

	return sources.some((source) => {
		const path = source
			.split("?")[0]
			.replace(/\/+/g, "/")
			.toLowerCase();

		return path === "/machflow/request" || path.endsWith("/machflow/request");
	});
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

	/*
	 * Resolve once for this page load. Public candidate/joinee links are opened
	 * as standalone pages, so they must not be forced through FlowSuite login.
	 */
	const publicHrPortal = useMemo(
		() => resolveHrPublicPortal(),
		[]
	);

	const publicMachFlowPortal = useMemo(
		() => resolveMachFlowPublicPortal(),
		[]
	);

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
		/*
		 * Critical HRFlow isolation:
		 *
		 * Candidate/joinee links are authenticated by their HRFlow token, not
		 * by /auth/me. Do not initialise the ordinary FlowSuite session on
		 * those two standalone public pages.
		 */
		if (publicHrPortal || publicMachFlowPortal) {
			setAuthLoading(false);
		} else {
			loadMe();
		}

		const onUnauthorized = () => {
			/*
			 * A 401 from an invalid/expired HRFlow public token must be shown
			 * inside the public portal. It must not turn into a FlowSuite login
			 * redirect or clear a user's stored FlowSuite session.
			 */
			if (resolveHrPublicPortal() || resolveMachFlowPublicPortal()) {
				return;
			}

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
		publicHrPortal,
		publicMachFlowPortal,
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

	/*
	 * PRIMARY MACHFLOW REQUEST GATE
	 *
	 * This page can be opened by a QR without creating a FlowSuite account.
	 * Identity enforcement happens through either an existing FlowSuite session
	 * or a controlled Reporter Pass. Other FlowSuite routes are unchanged.
	 */
	if (publicMachFlowPortal) {
		return (
			<AuthContext.Provider value={value}>
				<MachFlowRequestPortal />
			</AuthContext.Provider>
		);
	}

	/*
	 * PRIMARY PUBLIC-HR GATE
	 *
	 * This is intentionally above the application's normal router content.
	 * Therefore even if App.jsx currently has an authenticated wildcard or
	 * login redirect, a direct /hr/apply/... or /hr/onboarding/... browser
	 * request renders the correct token portal instead.
	 *
	 * No PackFlow/BOMFlow/MatFlow/other-module route is changed.
	 */
	if (publicHrPortal) {
		return (
			<AuthContext.Provider
				value={value}
			>
				<HrFlowThemeProvider>
					{publicHrPortal.mode ===
					"apply" ? (
						<HrCandidateApplicationPage
							token={
								publicHrPortal.token
							}
						/>
					) : (
						<HrOnboardingPortalPage
							token={
								publicHrPortal.token
							}
						/>
					)}
				</HrFlowThemeProvider>
			</AuthContext.Provider>
		);
	}

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
