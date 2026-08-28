package com.alsorg.packing.assetflow;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

/**
 * Isolated security chain for Reporter Pass / public QR request APIs.
 *
 * These endpoints authenticate with Reporter Code + PIN inside AssetFlowService
 * and do not use FlowSuite cookie/Bearer authentication. CSRF is therefore
 * disabled only for /api/assetflow/public/**; all authenticated AssetFlow routes
 * remain under the application's normal Phase-3A CSRF/session architecture.
 */
@Configuration
public class AssetFlowPublicSecurityConfig {

    @Bean
    @Order(-90)
    SecurityFilterChain assetFlowPublicSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/assetflow/public/**")
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .securityContext(context ->
                        context.securityContextRepository(new NullSecurityContextRepository()))
                .requestCache(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .headers(headers -> headers
                        .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy", "no-referrer"))
                        .addHeaderWriter(new StaticHeadersWriter("X-Robots-Tag", "noindex, nofollow, noarchive"))
                        .addHeaderWriter(new StaticHeadersWriter("Cache-Control", "no-store")));

        return http.build();
    }
}
