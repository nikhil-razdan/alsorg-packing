package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.CreateVendorQuoteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseQueueResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.QuoteActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.QuoteComparisonResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.SaveVendorQuoteLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.VendorQuoteResponse;

import com.alsorg.packing.service.matflow.MatFlowQuotationService;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/matflow/purchase")
public class MatFlowPurchaseQuoteController {

    private final MatFlowQuotationService service;

    public MatFlowPurchaseQuoteController(
            MatFlowQuotationService service) {

        this.service = service;
    }

    @GetMapping("/indents/pending")
    public List<PurchaseQueueResponse> pendingQueue(
            @RequestParam(required = false)
            String plantCode) {

        return service.pendingPurchaseQueue(
                plantCode
        );
    }

    @PostMapping("/quotes")
    public VendorQuoteResponse createDraft(
            @RequestBody
            CreateVendorQuoteRequest req) {

        return service.createDraft(req);
    }

    @PostMapping("/quotes/{quoteId}/lines")
    public VendorQuoteResponse saveLine(
            @PathVariable
            UUID quoteId,

            @RequestBody
            SaveVendorQuoteLineRequest req) {

        return service.saveLine(
                quoteId,
                req
        );
    }

    @PatchMapping("/quotes/{quoteId}/submit")
    public VendorQuoteResponse submit(
            @PathVariable
            UUID quoteId,

            @RequestBody
            QuoteActionRequest req) {

        return service.submit(
                quoteId,
                req
        );
    }

    @PatchMapping("/quotes/{quoteId}/cancel")
    public VendorQuoteResponse cancel(
            @PathVariable
            UUID quoteId,

            @RequestBody
            QuoteActionRequest req) {

        return service.cancel(
                quoteId,
                req
        );
    }

    @GetMapping("/quotes/{quoteId}")
    public VendorQuoteResponse detail(
            @PathVariable
            UUID quoteId) {

        return service.detail(
                quoteId
        );
    }

    @GetMapping("/indents/{indentId}/quote-comparison")
    public QuoteComparisonResponse comparison(
            @PathVariable
            UUID indentId) {

        return service.comparison(
                indentId
        );
    }
}