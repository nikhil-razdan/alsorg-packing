package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrAccessRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class HrAccessDtos {

    private HrAccessDtos() {
    }

    public record GrantAccessRequest(
            @NotBlank String principalName,
            @NotNull HrAccessRole role
    ) {}

    public record AccessGrantResponse(
            UUID id,
            String principalName,
            HrAccessRole role,
            boolean active,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt
    ) {}

    public record MyAccessResponse(
            String principalName,
            boolean globalAdmin,
            boolean allowed,
            List<HrAccessRole> roles
    ) {}
}
