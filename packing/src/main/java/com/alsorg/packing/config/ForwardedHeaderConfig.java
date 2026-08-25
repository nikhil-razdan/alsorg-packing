package com.alsorg.packing.config;

import org.springframework.context.annotation.Configuration;

/**
 * Forwarded headers are handled by:
 *
 *     server.forward-headers-strategy=framework
 *
 * Keeping a second explicit ForwardedHeaderFilter bean would cause the same
 * proxy headers to be processed twice. The class remains as a harmless
 * compatibility placeholder so existing source layout does not need to change.
 */
@Configuration
public class ForwardedHeaderConfig {
}
