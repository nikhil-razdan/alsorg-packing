package com.alsorg.packing.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({
            "/",
            "/login",
            "/dashboard",
            "/inventory",
            "/dispatch",
            "/dispatch/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
