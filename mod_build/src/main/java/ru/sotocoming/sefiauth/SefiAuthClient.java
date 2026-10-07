package ru.sotocoming.sefiauth;

import com.google.gson.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.*;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.network.PacketByteBuf;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class SefiAuthClient implements ClientModInitializer {
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(2),
        r -> { Thread t = new Thread(r, "SefiAuth-Client"); t.setDaemon(true); return t; }, new ThreadPoolExecutor.AbortPolicy());
    private volatile KeyPair key;
    private volatile Object connection;
    private final AtomicBoolean attempted = new AtomicBoolean();
    private boolean helloSent;
    @Override public void onInitializeClient() {
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> { key = null; connection = null; attempted.set(false); helloSent = false; });
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            key = null; connection = null; attempted.set(false); helloSent = false;
            if (!System.getProperty("sefi.authPort", "").matches("[0-9]{4,5}")) return;
            var entry = client.getCurrentServerEntry();
            String expected = System.getProperty("sefi.serverAddress", "").toLowerCase(Locale.ROOT).replaceFirst(":25565$", "");
            if (entry == null || expected.isBlank()
                    || !entry.address.toLowerCase(Locale.ROOT).replaceFirst(":25565$", "").equals(expected)) return;
            // Only send a public ephemeral key; never a credential on JOIN.
            try {
                key = KeyPairGenerator.getInstance("Ed25519").generateKeyPair(); connection = handler;
            } catch (Exception ignored) { key = null; }
        });
        // Fabric's channel advertisement can arrive after JOIN; wait for it without sending credentials.
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (key == null || helloSent || connection != client.getNetworkHandler()
                    || !ClientPlayNetworking.canSend(SefiAuthCommon.HELLO)) return;
            helloSent = true;
            PacketByteBuf out = net.fabricmc.fabric.api.networking.v1.PacketByteBufs.create();
            out.writeString(Base64.getEncoder().encodeToString(key.getPublic().getEncoded()));
            ClientPlayNetworking.send(SefiAuthCommon.HELLO, out);
        });
        ClientPlayNetworking.registerGlobalReceiver(SefiAuthCommon.CHALLENGE, (client, handler, buf, sender) -> {
            if (connection != handler || key == null || !attempted.compareAndSet(false, true)) return;
            final String challenge, signature;
            final KeyPair sessionKey = key;
            try {
                challenge = buf.readString(1800); signature = buf.readString(86);
                if (buf.readableBytes() != 0) return;
                JsonObject data = JsonParser.parseString(new String(Base64.getUrlDecoder().decode(challenge), StandardCharsets.UTF_8)).getAsJsonObject();
                if (!Base64.getEncoder().encodeToString(sessionKey.getPublic().getEncoded()).equals(data.get("client_key").getAsString())) return;
            } catch (Exception ignored) { return; }
            try { worker.execute(() -> {
                try {
                    int port = Integer.parseInt(System.getProperty("sefi.authPort"));
                    if (port < 1024 || port > 65535) return;
                    JsonObject data = new JsonObject(); data.addProperty("challenge", challenge); data.addProperty("signature", signature);
                    HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/sefi/game-ticket"))
                        .timeout(Duration.ofSeconds(15)).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(data.toString())).build();
                    HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).followRedirects(HttpClient.Redirect.NEVER).build();
                    HttpResponse<java.io.InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
                    String ticket;
                    try (var input = response.body()) {
                        byte[] raw = input.readNBytes(1025);
                        if (response.statusCode() != 200 || raw.length > 1024) return;
                        ticket = JsonParser.parseString(new String(raw, StandardCharsets.UTF_8)).getAsJsonObject().get("ticket").getAsString();
                    }
                    if (!ticket.matches("[A-Za-z0-9_-]{43}")) return;
                    Signature signer = Signature.getInstance("Ed25519"); signer.initSign(sessionKey.getPrivate());
                    signer.update((challenge + "." + ticket).getBytes(StandardCharsets.UTF_8));
                    String proof = Base64.getUrlEncoder().withoutPadding().encodeToString(signer.sign());
                    client.execute(() -> {
                        if (connection != handler || client.getNetworkHandler() != handler || key != sessionKey) return;
                        PacketByteBuf out = net.fabricmc.fabric.api.networking.v1.PacketByteBufs.create(); out.writeString(ticket); out.writeString(proof);
                        ClientPlayNetworking.send(SefiAuthCommon.TICKET, out);
                    });
                } catch (Exception ignored) { /* Password fallback, never log credential-bearing exceptions. */ }
            }); } catch (RejectedExecutionException ignored) { }
        });
    }
}
