package ru.sotocoming.sefiskins;
import com.google.gson.*;
import com.mojang.authlib.GameProfile;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public final class CommunitySkins {
    public record Skin(Identifier texture, String model) {}
    private static final class Entry { Skin skin; boolean pending; long next; }
    // Only accessed on Minecraft's client thread. Network/decode never block rendering.
    private static final LinkedHashMap<UUID, Entry> CACHE = new LinkedHashMap<>(256, .75f, true);
    private static final ThreadPoolExecutor WORKER = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(128), r -> { Thread t = new Thread(r, "SEFI-Skins"); t.setDaemon(true); return t; });
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    private static String origin() {
        String value = System.getProperty("sefi.skinApi", "");
        if (value.equals("https://mc.sotocoming.ru")) return value;
        // Explicit local development only; never a remote URL from a game server.
        if (value.matches("http://(127\\.0\\.0\\.1|localhost):[0-9]{2,5}")) return value;
        return null;
    }
    public static Skin get(GameProfile profile) {
        String base = origin();
        if (base == null || !SkinIdentity.accepts(profile.getId(), profile.getName(), false)) return null;
        UUID offline = profile.getId();
        Entry entry = CACHE.computeIfAbsent(offline, ignored -> new Entry());
        if (CACHE.size() > 256) {
            var iterator = CACHE.entrySet().iterator();
            var removed = iterator.next(); iterator.remove(); destroy(removed.getValue().skin);
        }
        if (!entry.pending && System.nanoTime() >= entry.next) {
            entry.pending = true;
            try { WORKER.execute(() -> load(base, offline, profile.getName(), entry)); }
            catch (RejectedExecutionException ignored) { entry.pending = false; entry.next = System.nanoTime() + TimeUnit.SECONDS.toNanos(10); }
        }
        return entry.skin;
    }
    private static void destroy(Skin skin) {
        if (skin != null) MinecraftClient.getInstance().getTextureManager().destroyTexture(skin.texture());
    }
    private static void load(String base, UUID id, String name, Entry entry) {
        NativeImage decoded = null;
        String hash = null, model = null;
        boolean success = false;
        try {
            var request = HttpRequest.newBuilder(URI.create(base + "/api/public/community/skins/" + id + "?name=" + name))
                .timeout(Duration.ofSeconds(8)).GET().build();
            var response = HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
            byte[] raw;
            try (var input = response.body()) { raw = input.readNBytes(90001); }
            if (response.statusCode() != 200 || raw.length > 90000) throw new Exception();
            JsonElement value = JsonParser.parseString(new String(raw, StandardCharsets.UTF_8)).getAsJsonObject().get("skin");
            if (value == null) throw new Exception();
            if (!value.isJsonNull()) {
                var object = value.getAsJsonObject();
                model = object.get("model").getAsString(); hash = object.get("sha256").getAsString();
                if (!(model.equals("classic") || model.equals("slim")) || !hash.matches("[a-f0-9]{64}")) throw new Exception();
                byte[] png = Base64.getDecoder().decode(object.get("png").getAsString());
                if (png.length > 65536 || png.length < 33 || !Arrays.equals(Arrays.copyOf(png, 8), new byte[]{(byte)137,80,78,71,13,10,26,10})) throw new Exception();
                var header = java.nio.ByteBuffer.wrap(png);
                if (header.getInt(16) != 64 || header.getInt(20) != 64) throw new Exception();
                if (!HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(png)).equals(hash)) throw new Exception();
                decoded = NativeImage.read(new ByteArrayInputStream(png));
                if (decoded.getWidth() != 64 || decoded.getHeight() != 64) throw new Exception();
            }
            success = true;
        } catch (Exception ignored) { if (decoded != null) decoded.close(); decoded = null; }
        final NativeImage image = decoded;
        final String digest = hash, shape = model;
        final boolean ok = success;
        MinecraftClient.getInstance().execute(() -> {
            if (CACHE.get(id) != entry) { if (image != null) image.close(); return; }
            entry.pending = false;
            entry.next = System.nanoTime() + TimeUnit.SECONDS.toNanos(ok ? 45 : 10);
            // Fail closed: an expired skin must not survive an identity change or service outage.
            if (!ok || image == null) { destroy(entry.skin); entry.skin = null; return; }
            Identifier texture = new Identifier("sefi_skins", id.toString() + "/" + digest);
            if (entry.skin != null && entry.skin.texture().equals(texture)) image.close();
            else {
                destroy(entry.skin);
                MinecraftClient.getInstance().getTextureManager().registerTexture(texture, new NativeImageBackedTexture(image));
            }
            entry.skin = new Skin(texture, shape.equals("slim") ? "slim" : "default");
        });
    }
}
