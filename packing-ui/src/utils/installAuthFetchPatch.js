import {
	isFlowSuiteApiRequest,
	secureFetch,
} from "../services/api";

let installed = false;

/*
 * Transitional bridge for FlowSuite modules that still call window.fetch
 * directly. PackFlow's reviewed code already uses API/secureFetch, but this
 * bridge prevents an older raw-fetch caller elsewhere in the SPA from bypassing
 * cookie credentials, CSRF, request correlation and centralized 401 handling.
 *
 * services/api.js captures the native fetch before this patch is installed, so
 * secureFetch does not recurse back through window.fetch.
 */
export function installAuthFetchPatch() {
	if (
		installed ||
		typeof window === "undefined" ||
		typeof window.fetch !== "function"
	) {
		return;
	}

	installed = true;

	const nativeFetch =
		window.fetch.bind(window);

	window.fetch = (input, init = {}) => {
		if (!isFlowSuiteApiRequest(input)) {
			return nativeFetch(input, init);
		}

		return secureFetch(input, init);
	};
}
