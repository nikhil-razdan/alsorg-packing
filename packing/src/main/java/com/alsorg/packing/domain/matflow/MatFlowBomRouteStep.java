package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_bom_route_steps", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_route_line_sequence", columnNames = {
                "bom_line_id",
                "sequence_no"
        })
}, indexes = {
        @Index(name = "idx_mf_route_bom_line", columnList = "bom_line_id"),
        @Index(name = "idx_mf_route_location", columnList = "location_id")
})
public class MatFlowBomRouteStep
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_line_id", nullable = false)
    public MatFlowBomLine bomLine;

    @Column(name = "sequence_no", nullable = false)
    public Integer sequenceNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false, length = 40)
    public RouteStepType stepType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    public MatFlowLocation location;

    @Column(name = "process_code", length = 100)
    public String processCode;

    @Column(name = "expected_yield_percent", nullable = false, precision = 8, scale = 3)
    public BigDecimal expectedYieldPercent = new BigDecimal("100.000");

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}