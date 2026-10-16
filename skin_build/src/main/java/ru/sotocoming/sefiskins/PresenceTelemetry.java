package ru.sotocoming.sefiskins;

import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import java.nio.file.*;
import java.util.concurrent.*;

/** Local, per-launch heartbeat only. Never reads accounts or sends network requests. */
public final class PresenceTelemetry {
    private static final Path FILE = target();
    private static final ExecutorService WRITER = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "SEFI-Presence"); thread.setDaemon(true); return thread;
    });
    private static long next;
    private static volatile boolean pending;
    private static Path target() {
        String value = System.getProperty("sefi.presenceFile", "");
        if (value.isBlank()) return null;
        try {
            Path path = Path.of(value);
            return path.isAbsolute() && path.getFileName().toString().equals("state.json") ? path : null;
        } catch (Exception ignored) { return null; }
    }
    public static void tick(MinecraftClient client) {
        if (FILE == null || pending || System.nanoTime() < next) return;
        next = System.nanoTime() + TimeUnit.SECONDS.toNanos(4);
        JsonObject state = new JsonObject();
        if (client.world == null) state.addProperty("mode", "menu");
        else if (client.isInSingleplayer()) state.addProperty("mode", "singleplayer");
        else {
            var server = client.getCurrentServerEntry();
            if (server == null) state.addProperty("mode", "multiplayer");
            else { state.addProperty("mode", "multiplayer"); state.addProperty("server", server.address); }
        }
        String json = state.toString();
        pending = true;
        WRITER.execute(() -> {
            Path temp = FILE.resolveSibling("state.json.tmp");
            try {
                Files.writeString(temp, json);
                try { Files.move(temp, FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
                catch (AtomicMoveNotSupportedException ignored) { Files.move(temp, FILE, StandardCopyOption.REPLACE_EXISTING); }
            } catch (Exception ignored) {
                // The launcher may have exited. Presence must never affect gameplay.
            } finally { pending = false; }
        });
    }
    private PresenceTelemetry() {}
}
