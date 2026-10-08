package ru.sotocoming.sefiauth;

/** One delayed retry per authenticated game connection, never before login. */
final class VoiceChatReconnect {
    private boolean scheduled;
    private int ticks = -1;
    void reset() { scheduled = false; ticks = -1; }
    void authenticated() {
        if (scheduled) return;
        scheduled = true;
        ticks = 20;
    }
    void tick(boolean sameConnection, Runnable retry) {
        if (!sameConnection) { reset(); return; }
        if (ticks < 0 || --ticks > 0) return;
        ticks = -1;
        retry.run();
    }
}