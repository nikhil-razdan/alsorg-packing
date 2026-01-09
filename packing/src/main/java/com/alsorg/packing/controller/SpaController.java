package com.alsorg.packing.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

	@GetMapping("/{path:^(?!api|static|assets).*}")
	public String redirect() {
	    return "forward:/index.html";
	}
}
