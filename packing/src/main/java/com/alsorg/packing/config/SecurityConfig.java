package com.alsorg.packing.config;

import com.alsorg.packing.security.CookieCsrfProtectionMatcher;
import com.alsorg.packing.security.FlowSuitePasswordEncoder;
import com.alsorg.packing.security.JwtAuthenticationFilter;
import com.alsorg.packing.security.RequestCorrelationFilter;
import com.alsorg.packing.security.SpaCsrfTokenRequestHandler;
import com.alsorg.packing.security.TrustedOriginFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SecurityConfig.class);

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final TrustedOriginFilter trustedOriginFilter;
    private final RequestCorrelationFilter requestCorrelationFilter;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            TrustedOriginFilter trustedOriginFilter,
            RequestCorrelationFilter requestCorrelationFilter) {

        this.jwtAuthenticationFilter =
                jwtAuthenticationFilter;

        this.trustedOriginFilter =
                trustedOriginFilter;

        this.requestCorrelationFilter =
                requestCorrelationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            CorsConfigurationSource corsConfigurationSource,
            @Value("${app.security.cookie-secure:false}") boolean forceSecureCookie,
            @Value("${app.security.cookie-same-site:Lax}") String configuredSameSite,
            @Value("${app.security.csrf.enabled:false}") boolean csrfEnabled)
            throws Exception {

        String csrfSameSite =
                normalizeSameSite(
                        configuredSameSite);

        CookieCsrfTokenRepository csrfRepository =
                new CookieCsrfTokenRepository();

        /*
         * The SPA obtains the token through GET /api/auth/csrf, therefore
         * JavaScript never needs to read the CSRF cookie itself.
         */
        csrfRepository.setCookieCustomizer(
                cookie ->
                        cookie
                                .httpOnly(true)
                                .secure(forceSecureCookie)
                                .sameSite(csrfSameSite)
                                .path("/"));

        SpaCsrfTokenRequestHandler csrfRequestHandler =
                new SpaCsrfTokenRequestHandler();

        http
                .cors(
                        cors ->
                                cors.configurationSource(
                                        corsConfigurationSource))

                /*
                 * Real CSRF protection for the browser HttpOnly-cookie path.
                 *
                 * - Web FlowSuite: access cookie + X-XSRF-TOKEN on unsafe calls.
                 * - ShipTrack/mobile: Bearer-only requests remain stateless and are
                 *   not forced through browser CSRF semantics.
                 * - Login is excluded because no authenticated browser session is
                 *   required yet; TrustedOriginFilter still enforces exact origins.
                 */
                .csrf(
                        csrf ->
                                csrf
                                        .csrfTokenRepository(
                                                csrfRepository)
                                        .csrfTokenRequestHandler(
                                                csrfRequestHandler)
                                        .requireCsrfProtectionMatcher(
                                                new CookieCsrfProtectionMatcher(
                                                        csrfEnabled)))


                .httpBasic(
                        httpBasic ->
                                httpBasic.disable())

                .formLogin(
                        formLogin ->
                                formLogin.disable())

                .logout(
                        logout ->
                                logout.disable())

                .requestCache(
                        requestCache ->
                                requestCache.disable())

                .sessionManagement(
                        session ->
                                session.sessionCreationPolicy(
                                        SessionCreationPolicy.STATELESS))

                /*
                 * Safe baseline headers for an API service.
                 *
                 * HSTS is written only for secure requests by Spring Security.
                 */
                .headers(
                        headers ->
                                headers
                                        .contentTypeOptions(
                                                Customizer.withDefaults())
                                        .frameOptions(
                                                frame ->
                                                        frame.deny())
                                        .referrerPolicy(
                                                referrer ->
                                                        referrer.policy(
                                                                ReferrerPolicy.NO_REFERRER))
                                        .httpStrictTransportSecurity(
                                                hsts ->
                                                        hsts
                                                                .includeSubDomains(true)
                                                                .maxAgeInSeconds(
                                                                        31_536_000L)))

                .exceptionHandling(
                        exception ->
                                exception
                                        .authenticationEntryPoint(
                                                (request, response, ex) ->
                                                        writeSecurityResponse(
                                                                request,
                                                                response,
                                                                HttpServletResponse.SC_UNAUTHORIZED,
                                                                "Unauthorized",
                                                                ex))
                                        .accessDeniedHandler(
                                                (request, response, ex) ->
                                                        writeSecurityResponse(
                                                                request,
                                                                response,
                                                                HttpServletResponse.SC_FORBIDDEN,
                                                                "Forbidden",
                                                                ex)))

                .authorizeHttpRequests(
                        auth ->
                                auth
                                        .dispatcherTypeMatchers(
                                                DispatcherType.ERROR,
                                                DispatcherType.ASYNC)
                                        .permitAll()

                                        .requestMatchers(
                                                "/error")
                                        .permitAll()

                                        .requestMatchers(
                                                HttpMethod.OPTIONS,
                                                "/**")
                                        .permitAll()

                                        /*
                                         * Render readiness/liveness endpoint.
                                         * Only health is publicly exposed by
                                         * management configuration.
                                         */
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/actuator/health",
                                                "/actuator/health/**")
                                        .permitAll()

                                        /*
                                         * AssetFlow reporter gateway retains
                                         * its own Reporter Code + PIN gate.
                                         */
                                        .requestMatchers(
                                                "/api/assetflow/public/**")
                                        .permitAll()

                                        .requestMatchers(
                                                "/api/auth/login",
                                                "/api/auth/logout",
                                                "/api/auth/me",
                                                "/api/auth/csrf")
                                        .permitAll()

                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/stickers/generated-history",
                                                "/api/stickers/generated-history/users")
                                        .authenticated()

                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/stickers/dispatched/*/ensure-history")
                                        .hasAnyAuthority(
                                                "ADMIN",
                                                "DISPATCH")

                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/stickers/*/history",
                                                "/api/stickers/history/*/download-pdf")
                                        .hasAnyAuthority(
                                                "ADMIN",
                                                "DISPATCH",
                                                "PACKING",
                                                "HARDWARE_PACKING")

                                        .requestMatchers(
                                                "/api/users/**")
                                        .hasAuthority(
                                                "ADMIN")

                                        .requestMatchers(
                                                "/api/hardware-packets/**")
                                        .authenticated()

                                        /*
                                         * Any future actuator endpoint that is
                                         * deliberately exposed must still be ADMIN.
                                         */
                                        .requestMatchers(
                                                "/actuator/**")
                                        .hasAuthority(
                                                "ADMIN")

                                        .anyRequest()
                                        .authenticated())

                /*
                 * Request id first, origin/CSRF defense second, authentication
                 * third. This ensures even rejected security requests receive a
                 * correlation id in logs and responses.
                 */
                .addFilterBefore(
                        requestCorrelationFilter,
                        SecurityContextHolderFilter.class)

                .addFilterAfter(
                        trustedOriginFilter,
                        RequestCorrelationFilter.class)

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Prevent Spring Boot from also registering these filter beans directly in
     * the servlet container. They are intentionally owned by the Spring
     * Security chain above.
     */
    @Bean
    public FilterRegistrationBean<RequestCorrelationFilter>
            requestCorrelationFilterRegistration(
                    RequestCorrelationFilter filter) {

        FilterRegistrationBean<RequestCorrelationFilter> registration =
                new FilterRegistrationBean<>(
                        filter);

        registration.setEnabled(false);

        return registration;
    }

    @Bean
    public FilterRegistrationBean<TrustedOriginFilter>
            trustedOriginFilterRegistration(
                    TrustedOriginFilter filter) {

        FilterRegistrationBean<TrustedOriginFilter> registration =
                new FilterRegistrationBean<>(
                        filter);

        registration.setEnabled(false);

        return registration;
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter>
            jwtAuthenticationFilterRegistration(
                    JwtAuthenticationFilter filter) {

        FilterRegistrationBean<JwtAuthenticationFilter> registration =
                new FilterRegistrationBean<>(
                        filter);

        registration.setEnabled(false);

        return registration;
    }

    private void writeSecurityResponse(
            HttpServletRequest request,
            HttpServletResponse response,
            int status,
            String message,
            Exception exception)
            throws IOException {

        String currentUri =
                request.getRequestURI();

        Object originalErrorUri =
                request.getAttribute(
                        RequestDispatcher.ERROR_REQUEST_URI);

        String username =
                request.getUserPrincipal() == null
                        ? "anonymous"
                        : request
                                .getUserPrincipal()
                                .getName();

        log.warn(
                "Security denied request: requestId={}, status={}, method={}, uri={}, "
                        + "originalErrorUri={}, dispatcher={}, user={}, committed={}, reason={}",
                response.getHeader(
                        RequestCorrelationFilter.HEADER),
                status,
                request.getMethod(),
                currentUri,
                originalErrorUri,
                request.getDispatcherType(),
                username,
                response.isCommitted(),
                exception == null
                        ? message
                        : exception.getClass()
                                .getSimpleName());

        if (response.isCommitted()) {
            return;
        }

        response.resetBuffer();

        response.setStatus(status);

        response.setContentType(
                MediaType.APPLICATION_JSON_VALUE);

        response.setCharacterEncoding(
                StandardCharsets.UTF_8.name());

        boolean csrfFailure =
                exception instanceof CsrfException;

        String body;

        if (status == HttpServletResponse.SC_UNAUTHORIZED) {
            body = "{\"message\":\"Unauthorized\"}";
        } else if (csrfFailure) {
            body = "{\"message\":\"Security token expired. Please retry.\","
                    + "\"code\":\"CSRF_INVALID\"}";
        } else {
            body = "{\"message\":\"Forbidden\"}";
        }

        response.getWriter()
                .write(body);

        response.flushBuffer();
    }

    @Bean
    public PasswordEncoder passwordEncoder(
            @Value("${app.security.password.bcrypt-strength:12}")
            int bcryptStrength) {

        return new FlowSuitePasswordEncoder(
                bcryptStrength);
    }

    private String normalizeSameSite(
            String value) {

        String clean = value == null
                ? "Lax"
                : value.trim();

        if ("None".equalsIgnoreCase(clean)) {
            return "None";
        }

        if ("Strict".equalsIgnoreCase(clean)) {
            return "Strict";
        }

        return "Lax";
    }
}
