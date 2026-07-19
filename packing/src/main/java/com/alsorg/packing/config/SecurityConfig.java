package com.alsorg.packing.config;

import com.alsorg.packing.security.JwtAuthenticationFilter;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

        private final JwtAuthenticationFilter jwtAuthenticationFilter;

        public SecurityConfig(
                        JwtAuthenticationFilter jwtAuthenticationFilter) {
                this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        }

        @Bean
        public SecurityFilterChain filterChain(
                        HttpSecurity http,
                        CorsConfigurationSource corsConfigurationSource) throws Exception {

                http
                                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                                .csrf(csrf -> csrf.disable())
                                .httpBasic(httpBasic -> httpBasic.disable())
                                .formLogin(formLogin -> formLogin.disable())
                                .logout(logout -> logout.disable())
                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS))
                                .exceptionHandling(exception -> exception
                                                .authenticationEntryPoint((request, response, ex) -> {
                                                        response.setStatus(401);
                                                        response.setContentType("application/json");
                                                        response.setCharacterEncoding("UTF-8");
                                                        response.getWriter()
                                                                        .write("{\"message\":\"Unauthorized\"}");
                                                })
                                                .accessDeniedHandler((request, response, ex) -> {
                                                        response.setStatus(403);
                                                        response.setContentType("application/json");
                                                        response.setCharacterEncoding("UTF-8");
                                                        response.getWriter()
                                                                        .write("{\"message\":\"Forbidden\"}");
                                                }))
                                .authorizeHttpRequests(auth -> auth

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
                                                 *
                                                 * The controller applies the final per-user rule:
                                                 * ADMIN sees all.
                                                 * Other authenticated users see their own.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/stickers/generated-history",
                                                                "/api/stickers/generated-history/users")
                                                .authenticated()

                                                /*
                                                 * Dispatch can repair/rebuild missing sticker history.
                                                 */
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/stickers/dispatched/*/ensure-history")
                                                .hasAnyAuthority(
                                                                "ADMIN",
                                                                "DISPATCH")

                                                /*
                                                 * Item-wise Sticker History modal and its PDF.
                                                 *
                                                 * Plant access and hardware ownership are still checked
                                                 * inside PacketService.
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
                                                .hasAuthority("ADMIN")

                                                /*
                                                 * HardwarePacketController already has method-level
                                                 * 
                                                 * @PreAuthorize rules.
                                                 */
                                                .requestMatchers(
                                                                "/api/hardware-packets/**")
                                                .authenticated()

                                                /*
                                                 * Everything else requires authentication.
                                                 */
                                                .anyRequest().authenticated())
                                .addFilterBefore(
                                                jwtAuthenticationFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
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