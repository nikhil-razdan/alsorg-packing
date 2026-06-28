import { API_BASE_URL } from "../config";

let installed = false;

const isBackendApiUrl = (url) => {
	if (!url) return false;

	const text = String(url);
	const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");

	return (
		text.startsWith(`${apiBase}/api`) ||
		text.startsWith("/api")
	);
};

const isBadAuthorization = (value) => {
	if (!value) return false;

	const clean = String(value).trim();

	return (
		clean === "Bearer" ||
		clean === "Bearer null" ||
		clean === "Bearer undefined" ||
		clean === "null" ||
		clean === "undefined"
	);
};

export function installAuthFetchPatch() {
	if (installed || typeof window === "undefined") {
		return;
	}

	installed = true;

	const nativeFetch = window.fetch.bind(window);

	window.fetch = (input, init = {}) => {
		const url =
			typeof input === "string"
				? input
				: input?.url;

		if (!isBackendApiUrl(url)) {
			return nativeFetch(input, init);
		}

		const headers = new Headers(
			init?.headers ||
				(input instanceof Request ? input.headers : undefined)
		);

		const authorization = headers.get("Authorization");

		if (isBadAuthorization(authorization)) {
			headers.delete("Authorization");
		}

		/*
		 * X-Username should not decide user identity anymore.
		 * Backend must take username from JWT/cookie.
		 */
		headers.delete("X-Username");

		const nextInit = {
			...init,
			credentials: "include",
			headers,
		};

		return nativeFetch(input, nextInit);
	};
}