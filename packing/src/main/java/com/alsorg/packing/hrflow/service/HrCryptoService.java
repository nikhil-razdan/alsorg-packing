package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.exception.HrFlowException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Service
public class HrCryptoService {

    private static final String TEXT_PREFIX = "enc:v1:";
    private static final byte[] BINARY_PREFIX = new byte[] { 'H', 'R', 'F', '1' };
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private final String keyBase64;
    private final SecureRandom secureRandom = new SecureRandom();

    public HrCryptoService(@Value("${hrflow.crypto-key-base64:}") String keyBase64) {
        this.keyBase64 = keyBase64 == null ? "" : keyBase64.trim();
    }

    public String encryptNullable(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return null;
        }

        byte[] encrypted = encryptRaw(plainText.getBytes(StandardCharsets.UTF_8));
        return TEXT_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted);
    }

    public String decryptNullable(String storedValue) {
        if (storedValue == null || storedValue.isBlank()) {
            return null;
        }

        // Backward-compatible fallback for any controlled legacy plaintext values.
        if (!storedValue.startsWith(TEXT_PREFIX)) {
            return storedValue;
        }

        try {
            byte[] payload = Base64.getUrlDecoder().decode(storedValue.substring(TEXT_PREFIX.length()));
            return new String(decryptRaw(payload), StandardCharsets.UTF_8);
        } catch (HrFlowException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to decrypt HRFLOW sensitive data", ex);
        }
    }

    /**
     * Encrypts document bytes before persistence. The returned payload includes
     * a small HRFLOW version marker followed by IV + AES-GCM ciphertext.
     */
    public byte[] encryptBytes(byte[] plainBytes) {
        if (plainBytes == null) {
            return null;
        }

        byte[] encrypted = encryptRaw(plainBytes);
        byte[] payload = new byte[BINARY_PREFIX.length + encrypted.length];
        System.arraycopy(BINARY_PREFIX, 0, payload, 0, BINARY_PREFIX.length);
        System.arraycopy(encrypted, 0, payload, BINARY_PREFIX.length, encrypted.length);
        return payload;
    }

    /**
     * Decrypts HRFLOW document bytes. A plaintext fallback is intentionally kept
     * only so a controlled migration of any pre-existing Batch-2 test rows does
     * not make those files unreadable.
     */
    public byte[] decryptBytes(byte[] storedBytes) {
        if (storedBytes == null) {
            return null;
        }

        if (!hasBinaryPrefix(storedBytes)) {
            return Arrays.copyOf(storedBytes, storedBytes.length);
        }

        byte[] encrypted = Arrays.copyOfRange(storedBytes, BINARY_PREFIX.length, storedBytes.length);
        return decryptRaw(encrypted);
    }

    private byte[] encryptRaw(byte[] plainBytes) {
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key(), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv)
            );

            byte[] encrypted = cipher.doFinal(plainBytes);
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return payload;
        } catch (HrFlowException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encrypt HRFLOW sensitive data", ex);
        }
    }

    private byte[] decryptRaw(byte[] payload) {
        if (payload == null || payload.length <= IV_BYTES) {
            throw new IllegalStateException("Encrypted HRFLOW payload is invalid.");
        }

        try {
            byte[] iv = Arrays.copyOfRange(payload, 0, IV_BYTES);
            byte[] encrypted = Arrays.copyOfRange(payload, IV_BYTES, payload.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key(), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv)
            );
            return cipher.doFinal(encrypted);
        } catch (HrFlowException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to decrypt HRFLOW sensitive data", ex);
        }
    }

    private boolean hasBinaryPrefix(byte[] value) {
        if (value.length < BINARY_PREFIX.length) {
            return false;
        }
        for (int i = 0; i < BINARY_PREFIX.length; i++) {
            if (value[i] != BINARY_PREFIX[i]) {
                return false;
            }
        }
        return true;
    }

    private byte[] key() {
        if (keyBase64.isBlank()) {
            throw HrFlowException.badRequest(
                    "HRFLOW encryption key is not configured. Set HRFLOW_CRYPTO_KEY_BASE64 / " +
                            "hrflow.crypto-key-base64 before storing sensitive HR data."
            );
        }

        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(keyBase64);
        } catch (IllegalArgumentException ex) {
            throw HrFlowException.badRequest("HRFLOW encryption key is not valid Base64.");
        }

        if (decoded.length != 16 && decoded.length != 24 && decoded.length != 32) {
            throw HrFlowException.badRequest("HRFLOW encryption key must decode to 16, 24, or 32 bytes.");
        }
        return decoded;
    }
}
