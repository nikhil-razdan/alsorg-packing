package com.alsorg.packing.integration.zoho;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
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

        // ✅ If token exists and not expired → reuse
        if (cachedAccessToken != null && tokenExpiryTime != null) {
            if (Instant.now().isBefore(tokenExpiryTime)) {
                return cachedAccessToken;
            }
        }

        // ❗ Only here we call Zoho
        String url =
                "https://accounts.zoho.in/oauth/v2/token"
                        + "?refresh_token=" + config.getRefreshToken()
                        + "&client_id=" + config.getClientId()
                        + "&client_secret=" + config.getClientSecret()
                        + "&grant_type=refresh_token";

        ResponseEntity<Map> response =
                restTemplate.postForEntity(url, null, Map.class);

        Map body = response.getBody();

        cachedAccessToken = (String) body.get("access_token");
        Integer expiresIn = (Integer) body.get("expires_in");

        // buffer
        tokenExpiryTime = Instant.now().plusSeconds(expiresIn - 60);

        return cachedAccessToken;
    }
}
