import { API_BASE_URL } from "../config";

let installed = false;

const isBadBearer = (value) => {
	if (!value) return true;

	const clean = String(value).trim();

	return (
		clean === "Bearer" ||
		clean === "Bearer null" ||
		clean === "Bearer undefined" ||
		clean === "null" ||
		clean === "undefined"
	);
};

const isBackendApiUrl = (url) => {
	if (!url) return false;

	const text = String(url);
	const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");

	return (
		text.startsWith(`${apiBase}/api`) ||
		text.startsWith("/api")
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

		const nextInit = {
			...init,
			credentials: "include",
		};

		const headers = new Headers(
			init?.headers ||
				(input instanceof Request ? input.headers : undefined)
		);

		const authorization =
			headers.get("Authorization");

		if (isBadBearer(authorization)) {
			headers.delete("Authorization");
		}

		headers.delete("X-Username");

		if ([...headers.keys()].length > 0) {
			nextInit.headers = headers;
		} else {
			delete nextInit.headers;
		}

		return nativeFetch(input, nextInit);
	};
}