package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowInsightDtos.*;
import com.alsorg.packing.service.matflow.MatFlowAccessService;
import com.alsorg.packing.service.matflow.MatFlowInsightService;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowInsightController {
    private final MatFlowInsightService service;
    private final MatFlowAccessService accessService;
    public MatFlowInsightController(MatFlowInsightService service, MatFlowAccessService accessService){this.service=service;this.accessService=accessService;}
    @GetMapping("/meta") public Map<String,Object> meta(){accessService.requireRead();return Map.of("allowedPlants",accessService.allowedPlants(),"workflowScope","DESIGN_TO_PRODUCTION_RELEASE","downstreamExecution","PENDING_VALIDATION");}
    @GetMapping("/insights/dashboard") public DashboardResponse dashboard(@RequestParam(required=false)String plantCode){return service.dashboard(plantCode);}
    @GetMapping("/insights/engineering-kpis") public EngineeringKpis engineeringKpis(@RequestParam(required=false)String plantCode){return service.engineeringKpis(plantCode);}
}
