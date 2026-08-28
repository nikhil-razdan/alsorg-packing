package com.alsorg.packing.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    /**
     * Compatibility forwarding only when the Spring service itself serves the
     * built SPA. API and actuator routes are intentionally not mapped here.
     */
    @GetMapping({
            "/",
            "/login",
            "/dashboard",
            "/inventory",
            "/dispatch",
            "/dispatch/**",
            "/modules",
            "/modules/**",
            "/packflow/**",
            "/bomflow/**",
            "/matflow/**",
            "/hr/**",
            "/assetflow/**",
            "/users",
            "/users/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
