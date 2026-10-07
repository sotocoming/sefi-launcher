package ru.sotocoming.sefiauth;

import com.google.gson.*;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.*;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.server.network.ServerPlayNetworkHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.net.URI;
import java.net.http.*;
import java.security.*;
import java.security.spec.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SefiAuthCommon implements ModInitializer {
    public static final Identifier HELLO = new Identifier("sefi", "hello_v2");
    public static final Identifier CHALLENGE = new Identifier("sefi", "challenge_v2");
    public static final Identifier TICKET = new Identifier("sefi", "ticket_v2");
    private static final Gson JSON = new Gson();
    private static final Logger LOG = LoggerFactory.getLogger("SefiAuth");
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private final ConcurrentMap<ServerPlayNetworkHandler, Pending> pending = new ConcurrentHashMap<>();
    private final Set<ServerPlayNetworkHandler> seen = ConcurrentHashMap.newKeySet();
    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 30, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(16), r -> { Thread t = new Thread(r, "SefiAuth-Verify"); t.setDaemon(true); return t; },
        new ThreadPoolExecutor.AbortPolicy());
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    private PrivateKey signingKey;
    private String verifySecret;
    private record Pending(String challenge, String signature, PublicKey clientKey, long expires, AtomicBoolean used) {}

    @Override public void onInitialize() {
        // Client installations carry no server secret and need no server configuration.
        Path config = FabricLoader.getInstance().getConfigDir().resolve("sefi-auth.json");
        if (Files.exists(config)) {
            try {
                JsonObject cfg = JsonParser.parseString(Files.readString(config)).getAsJsonObject();
                signingKey = KeyFactory.getInstance("Ed25519").generatePrivate(new PKCS8EncodedKeySpec(
                    Base64.getDecoder().decode(cfg.get("private_key").getAsString())));
                verifySecret = cfg.get("verify_secret").getAsString();
                if (!verifySecret.matches("[A-Za-z0-9_-]{64}")) throw new IllegalArgumentException();
                LOG.info("SEFI Auth v2 ready; connection proof required");
            } catch (Exception e) { signingKey = null; LOG.error("SEFI Auth disabled: invalid private server configuration"); }
        }
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> { pending.remove(handler); seen.remove(handler); });
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> { pool.shutdownNow(); pending.clear(); seen.clear(); });
        ServerPlayNetworking.registerGlobalReceiver(HELLO, (server, player, handler, buf, sender) -> {
            if (signingKey == null || buf.readableBytes() > 130 || seen.size() >= 64 || !seen.add(handler)) return;
            final String encoded;
            try { encoded = buf.readString(128); if (buf.readableBytes() != 0) return; }
            catch (Exception error) { LOG.warn("SEFI hello rejected: {}", error.getClass().getSimpleName()); return; }
            server.execute(() -> {
                if (player.networkHandler != handler || server.getPlayerManager().getPlayer(player.getUuid()) != player
                        || authenticated(player)) return;
                try {
                    PublicKey clientKey = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(encoded)));
                    if (!Arrays.equals(clientKey.getEncoded(), Base64.getDecoder().decode(encoded))) return;
                    byte[] nonce = new byte[32]; new SecureRandom().nextBytes(nonce);
                    long expires = System.currentTimeMillis() / 1000 + 45;
                    JsonObject data = new JsonObject(); data.addProperty("v", 2); data.addProperty("server", "sefi-homestead");
                    data.addProperty("nonce", B64.encodeToString(nonce)); data.addProperty("name", player.getGameProfile().getName());
                    data.addProperty("uuid", player.getUuid().toString()); data.addProperty("client_key", encoded); data.addProperty("expires", expires);
                    byte[] raw = JSON.toJson(data).getBytes(StandardCharsets.UTF_8);
                    Signature signer = Signature.getInstance("Ed25519"); signer.initSign(signingKey); signer.update(raw);
                    Pending state = new Pending(B64.encodeToString(raw), B64.encodeToString(signer.sign()), clientKey, expires, new AtomicBoolean());
                    pending.put(handler, state);
                    PacketByteBuf out = PacketByteBufs.create(); out.writeString(state.challenge()); out.writeString(state.signature());
                    ServerPlayNetworking.send(player, CHALLENGE, out);
                } catch (Exception error) { pending.remove(handler); LOG.warn("SEFI challenge unavailable: {}", error.getClass().getSimpleName()); }
            });
        });
        ServerPlayNetworking.registerGlobalReceiver(TICKET, (server, player, handler, buf, sender) -> {
            if (buf.readableBytes() > 132) return;
            Pending state = pending.get(handler);
            if (state == null || state.expires() <= System.currentTimeMillis() / 1000 || !state.used().compareAndSet(false, true)) return;
            final String ticket, proof;
            try {
                ticket = buf.readString(43); proof = buf.readString(86);
                if (buf.readableBytes() != 0 || !ticket.matches("[A-Za-z0-9_-]{43}") || !proof.matches("[A-Za-z0-9_-]{86}")) return;
                Signature check = Signature.getInstance("Ed25519"); check.initVerify(state.clientKey());
                check.update((state.challenge() + "." + ticket).getBytes(StandardCharsets.UTF_8));
                if (!check.verify(Base64.getUrlDecoder().decode(proof))) return;
            } catch (Exception ignored) { return; }
            try {
                pool.execute(() -> {
                    boolean ok = verify(state, ticket, player.getGameProfile().getName(), player.getUuid().toString());
                    server.execute(() -> {
                        pending.remove(handler, state);
                        if (!ok || state.expires() <= System.currentTimeMillis() / 1000 || player.networkHandler != handler
                                || server.getPlayerManager().getPlayer(player.getUuid()) != player || !handler.isConnectionOpen()) return;
                        if (authenticate(player)) player.sendMessage(Text.literal("§a[SEFI] Вход подтверждён лаунчером."), false);
                    });
                });
            } catch (RejectedExecutionException ignored) { pending.remove(handler, state); }
        });
    }
    private boolean verify(Pending state, String ticket, String name, String uuid) {
        try {
            JsonObject data = new JsonObject(); data.addProperty("ticket", ticket); data.addProperty("challenge", state.challenge());
            data.addProperty("signature", state.signature()); data.addProperty("nickname", name); data.addProperty("uuid", uuid);
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://mc.sotocoming.ru/api/public/community/launcher/ticket/verify"))
                .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json").header("X-SEFI-Server", verifySecret)
                .POST(HttpRequest.BodyPublishers.ofString(JSON.toJson(data))).build();
            HttpResponse<java.io.InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var input = response.body()) {
                byte[] raw = input.readNBytes(1025);
                return response.statusCode() == 200 && raw.length <= 1024
                    && JsonParser.parseString(new String(raw, StandardCharsets.UTF_8)).getAsJsonObject().get("ok").getAsBoolean();
            }
        } catch (Exception ignored) { return false; }
    }
    private boolean authenticated(ServerPlayerEntity player) {
        try { return (boolean) Class.forName("xyz.nikitacartes.easyauth.interfaces.PlayerAuth")
            .getMethod("easyAuth$isAuthenticated").invoke(player); }
        catch (Exception error) { LOG.warn("SEFI cannot read EasyAuth state: {}", error.getClass().getSimpleName()); return true; } // Never bypass an absent/incompatible EasyAuth.
    }
    private boolean authenticate(ServerPlayerEntity player) {
        try {
            Class<?> type = Class.forName("xyz.nikitacartes.easyauth.interfaces.PlayerAuth");
            if (!type.isInstance(player)) return false;
            type.getMethod("easyAuth$setAuthenticated", boolean.class).invoke(player, true);
            type.getMethod("easyAuth$restoreTrueLocation").invoke(player);
            return (boolean) type.getMethod("easyAuth$isAuthenticated").invoke(player);
        } catch (Exception ignored) {
            try { Class.forName("xyz.nikitacartes.easyauth.interfaces.PlayerAuth").getMethod("easyAuth$setAuthenticated", boolean.class).invoke(player, false); }
            catch (Exception ignoredAgain) { }
            LOG.warn("SEFI login could not be applied to EasyAuth; password login remains required"); return false;
        }
    }
}
