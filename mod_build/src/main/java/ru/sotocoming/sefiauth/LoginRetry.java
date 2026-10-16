package ru.sotocoming.sefiauth;

/** Wall-clock deadlines are independent of rendering speed. */
final class LoginRetry {
    private int attempts;
    private long deadline;
    private boolean active, waiting;
    void start(long now) { attempts = 0; active = true; waiting = false; deadline = now; }
    void reset() { active = false; waiting = false; }
    int attempt() { return attempts; }
    boolean active() { return active; }
    boolean tick(long now) {
        if (!active || now < deadline) return false;
        if (waiting) { fail(now, true); return false; }
        if (attempts >= 3) { reset(); return false; }
        attempts++; waiting = true; deadline = now + 30000; return true;
    }
    void fail(long now, boolean transientFailure) {
        if (!active) return;
        if (!transientFailure || attempts >= 3) { reset(); return; }
        waiting = false; deadline = now + 1500;
    }
}
