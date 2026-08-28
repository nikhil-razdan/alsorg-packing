package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionLineStatus;

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
@Table(name = "mf_requisition_lines", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_req_bom_line", columnNames = {"requisition_id", "bom_line_id"})
}, indexes = {
        @Index(name = "idx_mf_req_line_requisition", columnList = "requisition_id"),
        @Index(name = "idx_mf_req_line_material", columnList = "material_id")
})
public class MatFlowRequisitionLine extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_id", nullable = false)
    public MatFlowMaterialRequisition requisition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_line_id", nullable = false)
    public MatFlowBomLine bomLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issued_material_id")
    public MatFlowMaterial issuedMaterial;

    @Column(name = "line_no", nullable = false)
    public Integer lineNo;

    @Column(name = "requested_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal requestedQty;

    @Column(name = "reserved_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal reservedQty = BigDecimal.ZERO;

    @Column(name = "shortage_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal shortageQty = BigDecimal.ZERO;

    @Column(name = "issued_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal issuedQty = BigDecimal.ZERO;

    @Column(name = "consumed_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal consumedQty = BigDecimal.ZERO;

    @Column(name = "returned_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal returnedQty = BigDecimal.ZERO;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 60)
    public RequisitionLineStatus status = RequisitionLineStatus.PENDING_STORE_REVIEW;
}
