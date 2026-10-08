package ru.sotocoming.sefiskins;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Shared decision for render hooks and cache lookup; native/official textures always win. */
public final class SkinIdentity {
    private SkinIdentity() {}
    public static boolean accepts(UUID id, String name, boolean officialTexture) {
        return !officialTexture && id != null && name != null && name.matches("[A-Za-z0-9_]{3,16}")
            && id.equals(UUID.nameUUIDFromBytes(("OfflinePlayer:" + name).getBytes(StandardCharsets.UTF_8)));
    }
}
