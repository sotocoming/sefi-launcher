package ru.sotocoming.sefiskins;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
public class SkinIdentityCheck {
    private static void check(boolean value) { if (!value) throw new AssertionError("Official skin identity guard failed"); }
    public static void main(String[] args) {
        UUID offline = UUID.nameUUIDFromBytes("OfflinePlayer:Notch".getBytes(StandardCharsets.UTF_8));
        check(SkinIdentity.accepts(offline, "Notch", false));
        check(!SkinIdentity.accepts(offline, "Notch", true));
        check(!SkinIdentity.accepts(UUID.fromString("069a79f4-44e9-4726-a5be-fca90e38aaf5"), "Notch", false));
        check(!SkinIdentity.accepts(offline, "notch", false));
        check(!SkinIdentity.accepts(null, "Notch", false));
        check(!SkinIdentity.accepts(offline, null, false));
        check(!SkinIdentity.accepts(offline, "../Notch", false));
        System.out.println("PASS: offline UUID allowed; Microsoft UUID, official textures, wrong case and invalid profiles protected.");
    }
}
