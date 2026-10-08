package ru.sotocoming.sefiauth;

/** Hide only EasyAuth's premature warning while a launcher login is pending. */
final class LauncherLoginFeedback {
    private int ticks;
    void start() { ticks = 600; }
    void reset() { ticks = 0; }
    void confirmed() { reset(); }
    boolean suppress(String text) {
        if (ticks <= 0) return false;
        String plain = text.replaceAll("§[0-9A-FK-ORa-fk-or]", "").replace("\\n", "\n").trim();
        return plain.equals("You are not authenticated!\nUse /login or /l to authenticate.");
    }
    boolean tick() { return ticks > 0 && --ticks == 0; }
}