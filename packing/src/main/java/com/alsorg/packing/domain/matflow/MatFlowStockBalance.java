package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_stock_balances", uniqueConstraints = {
                @UniqueConstraint(name = "uk_mf_stock_material_location", columnNames = {
                                "material_id",
                                "location_id"
                })
}, indexes = {
                @Index(name = "idx_mf_stock_material", columnList = "material_id"),
                @Index(name = "idx_mf_stock_location", columnList = "location_id")
})
public class MatFlowStockBalance
                extends MatFlowBaseEntity {

        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "material_id", nullable = false)
        public MatFlowMaterial material;

        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "location_id", nullable = false)
        public MatFlowLocation location;

        @Column(name = "on_hand_qty", nullable = false, precision = 19, scale = 3)
        public BigDecimal onHandQty = BigDecimal.ZERO;

        @Column(name = "reserved_qty", nullable = false, precision = 19, scale = 3)
        public BigDecimal reservedQty = BigDecimal.ZERO;

        @Column(name = "blocked_qty", nullable = false, precision = 19, scale = 3)
        public BigDecimal blockedQty = BigDecimal.ZERO;

        @Column(name = "in_transit_qty", nullable = false, precision = 19, scale = 3)
        public BigDecimal inTransitQty = BigDecimal.ZERO;

        @Transient
        public BigDecimal availableQty() {

                BigDecimal safeOnHand = onHandQty == null
                                ? BigDecimal.ZERO
                                : onHandQty;

                BigDecimal safeReserved = reservedQty == null
                                ? BigDecimal.ZERO
                                : reservedQty;

                BigDecimal safeBlocked = blockedQty == null
                                ? BigDecimal.ZERO
                                : blockedQty;

                BigDecimal available = safeOnHand
                                .subtract(
                                                safeReserved)
                                .subtract(
                                                safeBlocked);

                return available.compareTo(
                                BigDecimal.ZERO) < 0
                                                ? BigDecimal.ZERO
                                                : available;
        }
}