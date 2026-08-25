package com.alsorg.packing.config;

import com.alsorg.packing.security.JwtAuthenticationFilter;
import com.alsorg.packing.security.RequestCorrelationFilter;
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

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
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
            CorsConfigurationSource corsConfigurationSource)
            throws Exception {

        http
                .cors(
                        cors ->
                                cors.configurationSource(
                                        corsConfigurationSource))

                /*
                 * FlowSuite currently has two auth transports:
                 *
                 * 1. Browser -> HttpOnly cookie
                 * 2. ShipTrack/mobile -> Authorization Bearer token
                 *
                 * Unsafe cookie-authenticated requests are protected by the
                 * exact-origin TrustedOriginFilter. This is deliberately kept
                 * separate from Bearer requests so ShipTrack is not broken.
                 *
                 * A synchronizer CSRF token can be added later when the shared
                 * frontend API interceptor is supplied, but unsafe browser
                 * requests are no longer accepted from arbitrary origins.
                 */
                .csrf(
                        csrf ->
                                csrf.disable())

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
                                                "/api/auth/me")
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
                        UsernamePasswordAuthenticationFilter.class)

                .addFilterAfter(
                        trustedOriginFilter,
                        RequestCorrelationFilter.class)

                .addFilterAfter(
                        jwtAuthenticationFilter,
                        TrustedOriginFilter.class);

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

        response.getWriter()
                .write(
                        status == HttpServletResponse.SC_UNAUTHORIZED
                                ? "{\"message\":\"Unauthorized\"}"
                                : "{\"message\":\"Forbidden\"}");

        response.flushBuffer();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {

        DelegatingPasswordEncoder encoder =
                (DelegatingPasswordEncoder)
                        PasswordEncoderFactories
                                .createDelegatingPasswordEncoder();

        /*
         * Keeps compatibility with older bcrypt hashes that were stored
         * without a {bcrypt} prefix.
         */
        encoder.setDefaultPasswordEncoderForMatches(
                new BCryptPasswordEncoder());

        return encoder;
    }
}
