package com.alsorg.packing.integration.zoho;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
public class ZohoAuthService {

    private final ZohoInventoryConfig config;
    private final RestTemplate restTemplate = new RestTemplate();

    private String cachedAccessToken;
    private Instant tokenExpiryTime;

    public ZohoAuthService(ZohoInventoryConfig config) {
        this.config = config;
    }

    public synchronized String getAccessToken() {

        // ✅ reuse token if valid
        if (cachedAccessToken != null && tokenExpiryTime != null) {
            if (Instant.now().isBefore(tokenExpiryTime)) {
                return cachedAccessToken;
            }
        }

        String url = "https://accounts.zoho.in/oauth/v2/token";

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("refresh_token", config.getRefreshToken());
        params.add("client_id", config.getClientId());
        params.add("client_secret", config.getClientSecret());
        params.add("grant_type", "refresh_token");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<MultiValueMap<String, String>> request =
                new HttpEntity<>(params, headers);

        ResponseEntity<Map> response =
                restTemplate.postForEntity(url, request, Map.class);

        Map body = response.getBody();

        if (body == null || !body.containsKey("access_token")) {
            throw new IllegalStateException("Zoho token response invalid: " + body);
        }

        cachedAccessToken = (String) body.get("access_token");
        Integer expiresIn = (Integer) body.get("expires_in");

        tokenExpiryTime = Instant.now().plusSeconds(expiresIn - 60);
        return cachedAccessToken;
    }
}