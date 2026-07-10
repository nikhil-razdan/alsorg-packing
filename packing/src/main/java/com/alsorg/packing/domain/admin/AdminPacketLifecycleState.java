package com.alsorg.packing.domain.admin;

public enum AdminPacketLifecycleState {

    CREATED(
            "Created",
            "Packet exists in Inventory and no active sticker has been generated."
    ),

    READY_PKD(
            "Sticker Printed / Ready in PKD",
            "Sticker is active and the packet is in the packing area."
    ),

    READY_FG(
            "Moved to FG",
            "Packet is ready and physically located in Finished Goods."
    ),

    READY_TO_STORE(
            "Ready To Store",
            "Packet has been selected for warehouse movement."
    ),

    WAREHOUSE_REQUESTED(
            "Warehouse Requested",
            "Warehouse gate pass has been generated and approval is pending."
    ),

    IN_WAREHOUSE(
            "In Warehouse",
            "Warehouse has approved and stored the packet."
    ),

    WAREHOUSE_RETURN_REQUESTED(
            "Warehouse Return Requested",
            "Return from warehouse has been requested."
    ),

    READY_TO_DISPATCH(
            "Ready To Dispatch",
            "Packet is ready for challan generation."
    ),

    DISPATCHED(
            "Dispatched",
            "Challan has been generated and the packet is dispatched."
    );

    private final String label;
    private final String description;

    AdminPacketLifecycleState(
            String label,
            String description
    ) {
        this.label = label;
        this.description = description;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }
}