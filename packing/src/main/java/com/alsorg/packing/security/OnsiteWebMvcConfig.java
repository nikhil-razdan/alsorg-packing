package com.alsorg.packing.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers the ONSITE defense-in-depth boundary without modifying existing MVC config. */
@Configuration
public class OnsiteWebMvcConfig implements WebMvcConfigurer {

    private final OnsiteApiIsolationInterceptor onsiteApiIsolationInterceptor;

    public OnsiteWebMvcConfig(OnsiteApiIsolationInterceptor onsiteApiIsolationInterceptor) {
        this.onsiteApiIsolationInterceptor = onsiteApiIsolationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(onsiteApiIsolationInterceptor)
                .addPathPatterns("/api/**");
    }
}
