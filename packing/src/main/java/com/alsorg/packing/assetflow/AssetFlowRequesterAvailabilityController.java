package com.alsorg.packing.assetflow;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Non-mutating requester capability probe for FlowSuite navigation/UI.
 *
 * AssetFlowService remains the source of truth for requester permission.
 * An authenticated user who is not linked to an approved Reporter profile (and
 * is not operational AssetFlow staff) is still NOT allowed to read/create
 * requester records. This endpoint only converts that expected authorization
 * miss into HTTP 200 + {allowed:false} so Module Hub can ask "should I show the
 * request card?" without generating an application-wide 403 event.
 *
 * /api/assetflow/requester/context, /requests and all mutations keep their
 * existing strict authorization behavior.
 */
@RestController
@RequestMapping("/api/assetflow/requester")
public class AssetFlowRequesterAvailabilityController {

    private final AssetFlowService service;

    public AssetFlowRequesterAvailabilityController(
            AssetFlowService service) {
        this.service = service;
    }

    @GetMapping("/availability")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> availability() {
        try {
            return service.requesterContext();
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode().value()
                    == HttpStatus.FORBIDDEN.value()) {
                return Map.of(
                        "allowed", false,
                        "identityType", "NONE");
            }

            throw exception;
        }
    }
}
