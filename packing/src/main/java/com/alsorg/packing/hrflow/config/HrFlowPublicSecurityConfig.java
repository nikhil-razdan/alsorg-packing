package com.alsorg.packing.hrflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Dedicated security chain for the token-secured HRFlow public portal APIs.
 *
 * IMPORTANT:
 * - This chain matches ONLY /api/hrflow/public/**
 * - It does not alter PackFlow, BOMFlow, MatFlow, Materials, Clients,
 *   Users, or the authenticated HRFlow workspace.
 * - Candidate/onboarding access is authenticated by the opaque HRFlow token
 *   carried in the URL and validated inside HrCandidateTokenService.
 *
 * The public portal is a stateless JSON API. CSRF protection is therefore
 * disabled ONLY for this matcher. Without this, GET can work while POST/PUT
 * submissions are rejected by Spring Security's CSRF filter.
 */
@Configuration
public class HrFlowPublicSecurityConfig {

    @Bean
    @Order(-100)
    SecurityFilterChain hrFlowPublicSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/hrflow/public/**")

                /*
                 * The token itself is the authorization secret for these
                 * stateless endpoints. They do not use a browser login session.
                 */
                .csrf(csrf -> csrf.disable())

                /*
                 * Preserve the application's existing CORS configuration.
                 * This is required when the frontend and backend are deployed
                 * on different origins.
                 */
                .cors(Customizer.withDefaults())

                /*
                 * Never create/use an authenticated FlowSuite HTTP session for
                 * a candidate or joinee portal request.
                 */
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                /*
                 * The controller/service layer validates the HRFlow token.
                 * Spring Security must allow the request to reach that layer.
                 */
                .authorizeHttpRequests(auth ->
                        auth.anyRequest().permitAll()
                )

                /*
                 * Public token endpoints do not need login redirects, saved
                 * requests, or server-side security-context persistence.
                 */
                .requestCache(cache -> cache.disable())
                .securityContext(context -> context.requireExplicitSave(false));

        return http.build();
    }
}
