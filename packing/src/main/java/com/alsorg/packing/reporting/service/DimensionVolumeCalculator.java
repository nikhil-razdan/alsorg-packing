package com.alsorg.packing.reporting.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * Converts the packet dimension string used by PackFlow into cubic metres.
 *
 * Existing AL plant records keep their established format, for example:
 *     48 L x 24 B x 12 H inches
 *
 * WR-38 product/package labels commonly use millimetres, for example:
 *     650 L x 530 B x 760 H mm
 *
 * The unit check below is deliberately additive: every existing value without
 * an explicit millimetre marker continues through the original inches -> metres
 * calculation unchanged.
 */
@Component
public class DimensionVolumeCalculator {

    private static final double INCHES_PER_METRE = 39.3701d;
    private static final double MILLIMETRES_PER_METRE = 1000d;

    private static final Pattern NUMBER_PATTERN = Pattern.compile(
            "[-+]?[0-9]+(?:\\.[0-9]+)?");

    private static final Pattern EXPLICIT_CBM_PATTERN = Pattern.compile(
            "([0-9]+(?:\\.[0-9]+)?)\\s*m(?:3|³)",
            Pattern.CASE_INSENSITIVE);

    /**
     * @return packet volume in m3 rounded to 3 decimals, or null when the
     *         stored dimension text cannot be resolved safely.
     */
    public Double calculateCbm(String dimensions) {
        if (dimensions == null || dimensions.trim().isBlank()) {
            return null;
        }

        String text = dimensions.trim();

        /*
         * Some legacy/display values may already contain "(0.123 m3)".
         * Prefer that explicit value instead of calculating it again.
         */
        Matcher explicit = EXPLICIT_CBM_PATTERN.matcher(text);
        if (explicit.find()) {
            try {
                return round3(Double.parseDouble(explicit.group(1)));
            } catch (NumberFormatException ignored) {
                // Continue with normal L x B x H parsing.
            }
        }

        String normalized = text
                .replace('×', 'x')
                .replace('X', 'x');

        String[] parts = normalized.split("\\s*x\\s*");

        if (parts.length < 3) {
            return null;
        }

        Double length = firstNumber(parts[0]);
        Double breadth = firstNumber(parts[1]);
        Double height = firstNumber(parts[2]);

        if (length == null
                || breadth == null
                || height == null
                || length <= 0d
                || breadth <= 0d
                || height <= 0d) {
            return null;
        }

        String unitText = text.toLowerCase(Locale.ROOT);

        double cubicMetres;

        if (containsMillimetreUnit(unitText)) {
            cubicMetres = (length * breadth * height)
                    / Math.pow(MILLIMETRES_PER_METRE, 3d);
        } else {
            /*
             * Backward compatibility: the existing PackFlow dimension contract
             * is inches when no explicit mm marker is present.
             */
            cubicMetres = (length * breadth * height)
                    / Math.pow(INCHES_PER_METRE, 3d);
        }

        if (!Double.isFinite(cubicMetres) || cubicMetres < 0d) {
            return null;
        }

        return round3(cubicMetres);
    }

    public double calculateCbmOrZero(String dimensions) {
        Double value = calculateCbm(dimensions);
        return value == null ? 0d : value;
    }

    private boolean containsMillimetreUnit(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        return Pattern.compile("(^|[^a-z])mm([^a-z]|$)")
                .matcher(value)
                .find()
                || value.contains("millimetre")
                || value.contains("millimeter");
    }

    private Double firstNumber(String value) {
        if (value == null) {
            return null;
        }

        Matcher matcher = NUMBER_PATTERN.matcher(value);

        if (!matcher.find()) {
            return null;
        }

        try {
            return Double.parseDouble(matcher.group());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private double round3(double value) {
        return BigDecimal.valueOf(value)
                .setScale(3, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
