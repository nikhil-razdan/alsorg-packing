package com.alsorg.packing.security;

/**
 * Legacy source-name compatibility placeholder.
 *
 * Authentication is implemented exclusively by {@link JwtAuthenticationFilter}.
 * This class is intentionally not a Spring bean and must not be registered as
 * another servlet/security filter.
 */
@Deprecated(forRemoval = true)
public final class JwtAuthenticatorFilter {

    private JwtAuthenticatorFilter() {
    }
}
