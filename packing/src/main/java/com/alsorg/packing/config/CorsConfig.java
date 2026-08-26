package com.alsorg.packing.config;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.security.allowed-origins:http://localhost:5173,http://localhost:3000,https://alsorg-packing-frontend.onrender.com}")
            String configuredOrigins) {

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowCredentials(true);

        config.setAllowedOrigins(
                parseExactOrigins(
                        configuredOrigins));

        config.setAllowedHeaders(
                List.of(
                        "Content-Type",
                        "Accept",
                        "Origin",
                        "X-Requested-With",
                        "Authorization",
                        "X-Username",
                        "X-Client-Type",
                        "X-Request-ID",
                        "X-XSRF-TOKEN"));

        config.setAllowedMethods(
                List.of(
                        "GET",
                        "HEAD",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"));

        config.setExposedHeaders(
                List.of(
                        "Content-Disposition",
                        "X-Trip-Id",
                        "X-Challan-No",
                        "X-Total-Pages",
                        "X-Total-Elements",
                        "X-Page-Number",
                        "X-Page-Size",
                        "X-Has-Next",
                        "X-Dispatch-Count-Reused",
                        "X-Request-ID",
                        "Retry-After"));

        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                config);

        return source;
    }

    private List<String> parseExactOrigins(
            String configuredOrigins) {

        Set<String> values = new LinkedHashSet<>();

        if (configuredOrigins != null) {
            Arrays.stream(
                            configuredOrigins.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .map(this::normalizeOrigin)
                    .filter(value -> value != null)
                    .forEach(values::add);
        }

        if (values.isEmpty()) {
            throw new IllegalStateException(
                    "At least one exact app.security.allowed-origins value is required");
        }

        return new ArrayList<>(values);
    }

    private String normalizeOrigin(
            String value) {

        try {
            URI uri = URI.create(value);

            String scheme = uri.getScheme();
            String host = uri.getHost();

            if (scheme == null
                    || host == null) {
                return null;
            }

            scheme = scheme.toLowerCase(
                    Locale.ROOT);

            host = host.toLowerCase(
                    Locale.ROOT);

            if (!"http".equals(scheme)
                    && !"https".equals(scheme)) {
                return null;
            }

            int port = uri.getPort();

            boolean defaultPort = port < 0
                    || ("http".equals(scheme)
                            && port == 80)
                    || ("https".equals(scheme)
                            && port == 443);

            return scheme
                    + "://"
                    + host
                    + (defaultPort
                            ? ""
                            : ":" + port);

        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
