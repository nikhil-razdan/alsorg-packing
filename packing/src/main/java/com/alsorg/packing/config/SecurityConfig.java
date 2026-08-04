package com.alsorg.packing.config;

import com.alsorg.packing.security.JwtAuthenticationFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

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

import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

        private static final Logger log = LoggerFactory.getLogger(
                        SecurityConfig.class);

        private final JwtAuthenticationFilter jwtAuthenticationFilter;

        public SecurityConfig(
                        JwtAuthenticationFilter jwtAuthenticationFilter) {

                this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        }

        @Bean
        public SecurityFilterChain filterChain(
                        HttpSecurity http,
                        CorsConfigurationSource corsConfigurationSource)
                        throws Exception {

                http
                                .cors(cors -> cors.configurationSource(
                                                corsConfigurationSource))

                                .csrf(csrf -> csrf.disable())

                                .httpBasic(httpBasic -> httpBasic.disable())

                                .formLogin(formLogin -> formLogin.disable())

                                .logout(logout -> logout.disable())

                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS))

                                /*
                                 * Exact location for unauthorized and forbidden
                                 * request logging.
                                 *
                                 * Both handlers verify response.isCommitted()
                                 * before attempting to write JSON.
                                 */
                                .exceptionHandling(exception -> exception

                                                .authenticationEntryPoint(
                                                                (request, response, ex) -> writeSecurityResponse(
                                                                                request,
                                                                                response,
                                                                                HttpServletResponse.SC_UNAUTHORIZED,
                                                                                "Unauthorized",
                                                                                ex))

                                                .accessDeniedHandler(
                                                                (request, response, ex) -> writeSecurityResponse(
                                                                                request,
                                                                                response,
                                                                                HttpServletResponse.SC_FORBIDDEN,
                                                                                "Forbidden",
                                                                                ex)))

                                .authorizeHttpRequests(auth -> auth

                                                /*
                                                 * Internal redispatches.
                                                 *
                                                 * The original HTTP request still passes
                                                 * normal JWT authentication and authorization.
                                                 *
                                                 * ERROR permits Spring/Tomcat to render an
                                                 * error response without security denying
                                                 * /error again.
                                                 *
                                                 * ASYNC protects any remaining legitimate
                                                 * asynchronous endpoints elsewhere in the app.
                                                 */
                                                .dispatcherTypeMatchers(
                                                                DispatcherType.ERROR,
                                                                DispatcherType.ASYNC)
                                                .permitAll()

                                                /*
                                                 * Do not secure Spring Boot's error endpoint.
                                                 * Otherwise a 401/403 can generate another
                                                 * 401/403 while processing /error.
                                                 */
                                                .requestMatchers(
                                                                "/error")
                                                .permitAll()

                                                /*
                                                 * CORS preflight.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.OPTIONS,
                                                                "/**")
                                                .permitAll()

                                                /*
                                                 * Public authentication endpoints.
                                                 */
                                                .requestMatchers(
                                                                "/api/auth/login",
                                                                "/api/auth/logout",
                                                                "/api/auth/me")
                                                .permitAll()

                                                /*
                                                 * Generated-history screen.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/stickers/generated-history",
                                                                "/api/stickers/generated-history/users")
                                                .authenticated()

                                                /*
                                                 * Dispatch can repair missing sticker history.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/stickers/dispatched/*/ensure-history")
                                                .hasAnyAuthority(
                                                                "ADMIN",
                                                                "DISPATCH")

                                                /*
                                                 * Sticker history modal and PDF.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/stickers/*/history",
                                                                "/api/stickers/history/*/download-pdf")
                                                .hasAnyAuthority(
                                                                "ADMIN",
                                                                "DISPATCH",
                                                                "PACKING",
                                                                "HARDWARE_PACKING")

                                                /*
                                                 * User management.
                                                 */
                                                .requestMatchers(
                                                                "/api/users/**")
                                                .hasAuthority(
                                                                "ADMIN")

                                                /*
                                                 * HardwarePacketController has method-level
                                                 * authorization rules.
                                                 */
                                                .requestMatchers(
                                                                "/api/hardware-packets/**")
                                                .authenticated()

                                                /*
                                                 * Everything else requires a valid JWT.
                                                 */
                                                .anyRequest()
                                                .authenticated())

                                .addFilterBefore(
                                                jwtAuthenticationFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        /**
         * Logs the denied request and safely writes the JSON response.
         *
         * This method must not attempt to modify a response that has
         * already been committed by another controller/filter.
         */
        private void writeSecurityResponse(
                        HttpServletRequest request,
                        HttpServletResponse response,
                        int status,
                        String message,
                        Exception exception)
                        throws IOException {

                String currentUri = request.getRequestURI();

                Object originalErrorUri = request.getAttribute(
                                RequestDispatcher.ERROR_REQUEST_URI);

                String username = request.getUserPrincipal() == null
                                ? "anonymous"
                                : request
                                                .getUserPrincipal()
                                                .getName();

                log.warn(
                                "Security denied request: status={}, method={}, uri={}, "
                                                + "originalErrorUri={}, dispatcher={}, user={}, "
                                                + "committed={}, reason={}",
                                status,
                                request.getMethod(),
                                currentUri,
                                originalErrorUri,
                                request.getDispatcherType(),
                                username,
                                response.isCommitted(),
                                exception == null
                                                ? message
                                                : exception.getMessage());

                /*
                 * This is the critical protection that your current
                 * inline handlers are missing.
                 */
                if (response.isCommitted()) {

                        log.warn(
                                        "Security response not written because HTTP response "
                                                        + "is already committed: method={}, uri={}, "
                                                        + "dispatcher={}",
                                        request.getMethod(),
                                        currentUri,
                                        request.getDispatcherType());

                        return;
                }

                /*
                 * Clears any uncommitted partial body while preserving the
                 * normal response object.
                 */
                response.resetBuffer();

                response.setStatus(
                                status);

                response.setContentType(
                                MediaType.APPLICATION_JSON_VALUE);

                response.setCharacterEncoding(
                                StandardCharsets.UTF_8.name());

                response
                                .getWriter()
                                .write(
                                                status == HttpServletResponse.SC_UNAUTHORIZED
                                                                ? "{\"message\":\"Unauthorized\"}"
                                                                : "{\"message\":\"Forbidden\"}");

                response.flushBuffer();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {

                DelegatingPasswordEncoder encoder = (DelegatingPasswordEncoder) PasswordEncoderFactories
                                .createDelegatingPasswordEncoder();

                encoder.setDefaultPasswordEncoderForMatches(
                                new BCryptPasswordEncoder());

                return encoder;
        }
}