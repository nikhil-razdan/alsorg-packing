package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrAccessGrant;
import com.alsorg.packing.hrflow.domain.HrAuditAction;
import com.alsorg.packing.hrflow.dto.HrAccessDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrAccessGrantRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class HrAccessGrantService {

    private final HrAccessGrantRepository repository;
    private final HrAccessService accessService;
    private final HrAuditService auditService;

    public HrAccessGrantService(HrAccessGrantRepository repository, HrAccessService accessService, HrAuditService auditService) {
        this.repository = repository;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    @Transactional
    public HrAccessDtos.AccessGrantResponse grant(HrAccessDtos.GrantAccessRequest request) {
        accessService.requireGlobalAdmin();

        if (request == null) {
            throw HrFlowException.badRequest("HRFLOW access grant request is required.");
        }
        if (request.role() == null) {
            throw HrFlowException.badRequest("HRFLOW access role is required.");
        }

        String principal = request.principalName() == null
                ? ""
                : request.principalName().trim();

        if (principal.isBlank()) {
            throw HrFlowException.badRequest("Principal name is required.");
        }
        if (principal.length() > 200) {
            throw HrFlowException.badRequest("Principal name is too long.");
        }

        String actor = accessService.actor();
        HrAccessGrant grant = repository.findByPrincipalNameIgnoreCaseAndRole(principal, request.role())
                .orElseGet(HrAccessGrant::new);
        if (grant.getId() == null) {
            grant.setPrincipalName(principal);
            grant.setRole(request.role());
            grant.setCreatedBy(actor);
        }
        grant.setActive(true);
        grant.setUpdatedBy(actor);
        grant.setUpdatedAt(LocalDateTime.now());
        grant = repository.save(grant);
        auditService.log(HrAuditAction.ACCESS_GRANTED, "ACCESS_GRANT", grant.getId().toString(), actor,
                "Granted " + grant.getRole() + " to " + grant.getPrincipalName(), null);
        return toResponse(grant);
    }

    @Transactional
    public HrAccessDtos.AccessGrantResponse revoke(UUID id) {
        accessService.requireGlobalAdmin();

        if (id == null) {
            throw HrFlowException.badRequest("HRFLOW access grant id is required.");
        }

        String actor = accessService.actor();
        HrAccessGrant grant = repository.findById(id)
                .orElseThrow(() -> HrFlowException.notFound("HRFLOW access grant not found."));
        grant.setActive(false);
        grant.setUpdatedBy(actor);
        grant.setUpdatedAt(LocalDateTime.now());
        auditService.log(HrAuditAction.ACCESS_REVOKED, "ACCESS_GRANT", grant.getId().toString(), actor,
                "Revoked " + grant.getRole() + " from " + grant.getPrincipalName(), null);
        return toResponse(grant);
    }

    @Transactional(readOnly = true)
    public List<HrAccessDtos.AccessGrantResponse> list() {
        accessService.requireGlobalAdmin();
        return repository.findAllByOrderByPrincipalNameAscRoleAsc().stream().map(this::toResponse).toList();
    }

    private HrAccessDtos.AccessGrantResponse toResponse(HrAccessGrant x) {
        return new HrAccessDtos.AccessGrantResponse(x.getId(), x.getPrincipalName(), x.getRole(), x.isActive(),
                x.getCreatedBy(), x.getCreatedAt(), x.getUpdatedBy(), x.getUpdatedAt());
    }
}
