package ru.sotocoming.sefiauth;
public final class VoiceChatReconnectTest {
    public static void main(String[] args) {
        var retry = new VoiceChatReconnect();
        int[] calls = {0};
        Runnable request = () -> calls[0]++;
        for (int i=0;i<100;i++) retry.tick(true, request);
        check(calls[0]==0, "Never retry before authentication");
        retry.authenticated();
        for (int i=0;i<19;i++) retry.tick(true, request);
        check(calls[0]==0, "Wait for authentication to settle");
        retry.tick(true, request);
        check(calls[0]==1, "Retry after successful authentication");
        retry.authenticated();
        for (int i=0;i<100;i++) retry.tick(true, request);
        check(calls[0]==1, "Duplicate success message must not reset a live handshake");
        retry.reset(); retry.authenticated(); retry.tick(false, request);
        for (int i=0;i<100;i++) retry.tick(true, request);
        check(calls[0]==1, "Disconnect cancels a stale request");
        retry.authenticated();
        for (int i=0;i<20;i++) retry.tick(true, request);
        check(calls[0]==2, "A new authenticated connection can retry again");
        System.out.println("Voice reconnect: auth gating, delay, single request, duplicate message, disconnect, reconnect PASS");
    }
    private static void check(boolean ok, String message) { if(!ok) throw new AssertionError(message); }
}
