package com.alsorg.packing.controller.advice;

import java.lang.reflect.Type;
import java.util.Locale;

import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import com.alsorg.packing.controller.dto.CreateItemRequest;

/**
 * WR-38 packet-creation compatibility rule.
 *
 * WR-38 uses the compact QR-only PackFlow workflow. Item Name, Product/PD No.,
 * Drawing No., Client Name and Client Address are therefore optional when a
 * WR-38 item/packet is created.
 *
 * PacketService intentionally keeps its existing WR-38 SKU/sticker contract.
 * In particular, existing WR-38 code expects a non-blank Product Code when it
 * derives the stored SKU. To preserve that workflow without widening any
 * security, ownership, plant or lifecycle rules, blank optional identity
 * Product Code alone is normalized to the neutral display value "-" before
 * the request reaches the controller/service layer because the existing WR-38
 * SKU contract still expects a non-blank SKU source. The other optional fields
 * remain blank when the user leaves them blank.
 *
 * Non-WR-38 requests are returned completely unchanged.
 */
@ControllerAdvice
public class Wr38PacketCreationRequestAdvice extends RequestBodyAdviceAdapter {

    private static final String WR38_PLANT_CODE = "WR-38";
    private static final String EMPTY_DISPLAY_VALUE = "-";

    @Override
    public boolean supports(
            MethodParameter methodParameter,
            Type targetType,
            Class<? extends HttpMessageConverter<?>> converterType) {

        return CreateItemRequest.class.isAssignableFrom(
                methodParameter.getParameterType());
    }

    @Override
    public Object afterBodyRead(
            Object body,
            HttpInputMessage inputMessage,
            MethodParameter parameter,
            Type targetType,
            Class<? extends HttpMessageConverter<?>> converterType) {

        if (!(body instanceof CreateItemRequest request)) {
            return body;
        }

        if (!isWr38(request.getPlantCode())) {
            return request;
        }

        request.setPdNo(
                optionalProductCodeValue(request.getPdNo()));

        return request;
    }

    private boolean isWr38(String plantCode) {
        if (plantCode == null) {
            return false;
        }

        return WR38_PLANT_CODE.equals(
                plantCode.trim().toUpperCase(Locale.ROOT));
    }

    private String optionalProductCodeValue(String value) {
        if (value == null || value.trim().isBlank()) {
            return EMPTY_DISPLAY_VALUE;
        }

        return value.trim().replaceAll("\\s+", " ");
    }
}
