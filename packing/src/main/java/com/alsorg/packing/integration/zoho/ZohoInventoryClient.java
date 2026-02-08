package com.alsorg.packing.integration.zoho;

import java.util.ArrayList;
import java.util.List;

import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ZohoInventoryClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ZohoAuthService zohoAuthService;
    private final ZohoInventoryConfig config;

    public ZohoInventoryClient(
            ZohoAuthService zohoAuthService,
            ZohoInventoryConfig config
    ) {
        this.zohoAuthService = zohoAuthService;
        this.config = config;
    }

    /* ---------------- FETCH ALL ITEMS ---------------- */

    public List<ZohoItemDTO> fetchAllItems() {

        List<ZohoItemDTO> allItems = new ArrayList<>();
        int page = 1;
        int perPage = 200;
        boolean hasMore = true;

        while (hasMore) {

            String url = config.getBaseUrl()
                    + "/inventory/v1/items"
                    + "?organization_id=" + config.getOrganizationId()
                    + "&page=" + page
                    + "&per_page=" + perPage;

            HttpHeaders headers = new HttpHeaders();
            headers.set(
                    "Authorization",
                    "Zoho-oauthtoken " + zohoAuthService.getAccessToken()
            );
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            ResponseEntity<String> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            String.class
                    );

            try {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(response.getBody());

                allItems.addAll(parseItems(root));

                hasMore = root
                        .path("page_context")
                        .path("has_more_page")
                        .asBoolean(false);

                page++;

            } catch (Exception e) {
                throw new RuntimeException("Failed during Zoho pagination", e);
            }
        }

        return allItems;
    }

    /* ---------------- PARSE ITEMS ---------------- */

    private List<ZohoItemDTO> parseItems(JsonNode root) {

        List<ZohoItemDTO> items = new ArrayList<>();
        JsonNode itemsNode = root.path("items");

        for (JsonNode node : itemsNode) {

            ZohoItemDTO dto = new ZohoItemDTO();

            dto.setZohoItemId(node.path("item_id").asText());
            dto.setName(node.path("name").asText(""));
            dto.setSku(node.path("sku").asText(""));
            dto.setDescription(node.path("description").asText(""));

            JsonNode cf = node.path("custom_field_hash");

            dto.setLocation(cf.path("cf_location").asText(""));
            dto.setClientName(cf.path("cf_client_name").asText(""));
            dto.setClientAddress(cf.path("cf_client_address").asText(""));
            dto.setFloor(textOrDash(cf, "cf_floor"));
            dto.setPdNo(textOrDash(cf, "cf_pd_no"));
            dto.setDrawingNo(textOrDash(cf, "cf_dwg_no"));
            dto.setRemarks(textOrDash(cf, "cf_remarks"));
            dto.setQuantity(parseQuantity(cf));

            items.add(dto);
        }

        return items;
    }

    /* ---------------- SINGLE ITEM ---------------- */

    public ZohoItemDTO fetchItemDetails(String itemId) {

        String url = config.getBaseUrl()
                + "/inventory/v1/items/" + itemId
                + "?organization_id=" + config.getOrganizationId();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(zohoAuthService.getAccessToken());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        ResponseEntity<String> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class
                );

        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode item = mapper.readTree(response.getBody()).path("item");

            ZohoItemDTO dto = new ZohoItemDTO();

            dto.setZohoItemId(item.path("item_id").asText());
            dto.setName(item.path("name").asText(""));
            dto.setSku(item.path("sku").asText(""));
            dto.setDescription(item.path("description").asText(""));

            JsonNode cf = item.path("custom_field_hash");

            dto.setLocation(textOrNull(cf, "cf_location"));
            dto.setClientName(textOrNull(cf, "cf_client_name"));
            dto.setClientAddress(textOrNull(cf, "cf_client_address"));
            dto.setFloor(textOrDash(cf, "cf_floor"));
            dto.setPdNo(textOrDash(cf, "cf_pd_no"));
            dto.setDrawingNo(textOrDash(cf, "cf_dwg_no"));
            dto.setRemarks(textOrDash(cf, "cf_remarks"));
            dto.setQuantity(parseQuantity(cf));

            return dto;

        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch Zoho item details", e);
        }
    }

    /* ---------------- HELPERS ---------------- */

    private String textOrNull(JsonNode node, String key) {
        return node.hasNonNull(key)
                && !node.path(key).asText().isBlank()
                ? node.path(key).asText()
                : null;
    }

    private String textOrDash(JsonNode node, String key) {
        return node.hasNonNull(key)
                && !node.path(key).asText().isBlank()
                ? node.path(key).asText()
                : "-";
    }

    private int parseQuantity(JsonNode cf) {
        if (cf.hasNonNull("cf_quantity")) {
            try {
                return Integer.parseInt(cf.path("cf_quantity").asText("1"));
            } catch (NumberFormatException ignored) {
            }
        }
        return 1;
    }

    public void updateStock(String zohoItemId, int quantity) {

        String url = config.getBaseUrl()
                + "/inventory/v1/items/" + zohoItemId
                + "?organization_id=" + config.getOrganizationId();

        HttpHeaders headers = new HttpHeaders();
        headers.set(
                "Authorization",
                "Zoho-oauthtoken " + zohoAuthService.getAccessToken()
        );
        headers.setContentType(MediaType.APPLICATION_JSON);

        String body = """
                {
                  "initial_stock": %d
                }
                """.formatted(quantity);

        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(body, headers),
                String.class
        );
    }
}
