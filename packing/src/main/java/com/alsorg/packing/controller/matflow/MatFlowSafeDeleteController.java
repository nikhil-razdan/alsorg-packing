package com.alsorg.packing.controller.matflow;

/**
 * Deprecated compatibility shell.
 *
 * <p>Do not annotate this class as a Spring controller. The canonical DELETE
 * routes already live in MatFlowBomController, MatFlowRequisitionController
 * and MatFlowMovementController. Keeping a second @RestController with the
 * same mappings creates ambiguous Spring MVC mappings at startup.</p>
 *
 * <p>This file may be deleted entirely after replacing the old duplicate
 * controller.</p>
 */
@Deprecated(forRemoval = true)
public final class MatFlowSafeDeleteController {
    private MatFlowSafeDeleteController() {
    }
}
