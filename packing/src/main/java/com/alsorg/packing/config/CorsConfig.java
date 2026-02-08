package com.alsorg.packing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        // 🔥 REQUIRED when using cookies / auth headers
        config.setAllowCredentials(true);

        // Frontend origin (Vite default)
        config.setAllowedOrigins(List.of("http://localhost:5173"));

        // Allow all headers
        config.setAllowedHeaders(List.of("*"));

        // Allowed HTTP methods
        config.setAllowedMethods(
                List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")
        );

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
