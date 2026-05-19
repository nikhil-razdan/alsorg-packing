package com.alsorg.packing.reporting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EmailService {

    private final String apiKey = System.getenv("RESEND_API_KEY");

    public void sendExcel(String to, String subject, byte[] file, String filename) {

        try {

            if (apiKey == null || apiKey.isBlank()) {
                throw new RuntimeException("RESEND_API_KEY is missing!");
            }

            String base64 = Base64.getEncoder().encodeToString(file);

            Map<String, Object> attachment = new HashMap<>();
            attachment.put("filename", filename);
            attachment.put("content", base64);

            Map<String, Object> body = new HashMap<>();
            body.put("from", "Alsorg Reports <onboarding@resend.dev>");
            body.put("to", List.of(to));
            body.put("subject", subject);
            body.put("html", "<p>Please find attached report.</p>");
            body.put("attachments", List.of(attachment));

            ObjectMapper mapper = new ObjectMapper();
            String json = mapper.writeValueAsString(body);

            URL url = new URL("https://api.resend.com/emails");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();

            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes());
            }

            int code = conn.getResponseCode();

            if (code >= 200 && code < 300) {
                System.out.println("✅ Email sent successfully");
            } else {
                System.out.println("❌ Failed with code: " + code);
                try (var errorStream = conn.getErrorStream()) {
                    if (errorStream != null) {
                        String error = new String(errorStream.readAllBytes());
                        System.out.println("Error: " + error);
                    }
                }
            }

        } catch (Exception e) {
            System.out.println("❌ Email sending failed");
            e.printStackTrace();
        }
    }
}