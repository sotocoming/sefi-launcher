package ru.sotocoming.sefiauth;

import java.util.Locale;

/** Exact configured endpoints only: no suffix matching or DNS expansion. */
public final class TrustedServerAddresses {
    private TrustedServerAddresses() {}
    private static String normalize(String address) {
        return address.trim().toLowerCase(Locale.ROOT).replaceFirst(":25565$", "");
    }
    public static boolean contains(String configured, String address) {
        if (configured == null || address == null || address.isBlank()) return false;
        String target = normalize(address);
        for (String candidate : configured.split(",")) {
            if (!candidate.isBlank() && normalize(candidate).equals(target)) return true;
        }
        return false;
    }
}
