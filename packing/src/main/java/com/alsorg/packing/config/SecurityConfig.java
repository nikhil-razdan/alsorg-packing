package com.alsorg.packing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            // ✅ Let Spring Security respect your CorsFilter
            .cors()
            .and()

            // ❌ Disable CSRF (API + session-based auth)
            .csrf(csrf -> csrf.disable())

            // ✅ Session handling controlled manually
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.ALWAYS)
            )

            // ✅ Explicitly allow sticker downloads (IMPORTANT)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/stickers/history/*/download").permitAll()
                .anyRequest().permitAll()
            );

        return http.build();
    }
}
