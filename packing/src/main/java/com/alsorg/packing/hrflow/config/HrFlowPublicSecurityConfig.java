package com.alsorg.packing.hrflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

/**
 * Dedicated security chain for HRFlow candidate/onboarding token APIs.
 *
 * This chain deliberately matches ONLY /api/hrflow/public/**. It therefore does
 * not change PackFlow, BOMFlow, MatFlow, Materials, Clients, Users, or the
 * authenticated HRFlow workspace.
 *
 * Public HRFlow requests are authorized by a high-entropy opaque token that is
 * validated in HrCandidateTokenService. They are not authenticated by the
 * FlowSuite browser session/cookie, so CSRF is disabled only for this isolated,
 * stateless matcher. The authenticated application remains governed by the main
 * FlowSuite security chain and its staged CSRF policy.
 */
@Configuration
public class HrFlowPublicSecurityConfig {

    @Bean
    @Order(-100)
    SecurityFilterChain hrFlowPublicSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/hrflow/public/**")

                /*
                 * Opaque HRFlow token endpoints are stateless and do not rely on
                 * automatically submitted browser credentials. Keep the CSRF
                 * exception scoped strictly to this matcher.
                 */
                .csrf(csrf -> csrf.disable())

                /* Preserve the application's central CORS configuration. */
                .cors(Customizer.withDefaults())

                /* Never create or reuse a FlowSuite login session here. */
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                /*
                 * Do not load/save a FlowSuite SecurityContext for token portal
                 * requests. Authorization is performed by HrCandidateTokenService.
                 */
                .securityContext(context -> context.disable())

                /* Public APIs do not need saved-request or logout machinery. */
                .requestCache(cache -> cache.disable())
                .logout(logout -> logout.disable())

                /* Allow the request to reach the opaque-token validation layer. */
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())

                /*
                 * Tokens currently remain in the URL for frontend compatibility.
                 * Prevent token-bearing URLs from being sent as referrers or indexed.
                 * Spring Security's normal cache-control/content-type/frame headers
                 * remain enabled as well.
                 */
                .headers(headers -> headers
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Referrer-Policy",
                                "no-referrer"))
                        .addHeaderWriter(new StaticHeadersWriter(
                                "X-Robots-Tag",
                                "noindex, nofollow, noarchive, nosnippet")));

        return http.build();
    }
}
