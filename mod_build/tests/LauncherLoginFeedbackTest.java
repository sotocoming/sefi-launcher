package ru.sotocoming.sefiauth;
public final class LauncherLoginFeedbackTest {
    private static final String WARNING = "§cYou are not authenticated!\\n§6Use /login or /l to authenticate.";
    public static void main(String[] args) {
        var feedback = new LauncherLoginFeedback();
        check(!feedback.suppress(WARNING), "Normal login errors stay visible");
        feedback.start();
        check(feedback.suppress(WARNING), "Only premature EasyAuth warning is deferred");
        check(!feedback.suppress("Wrong password"), "Real errors stay visible");
        check(!feedback.suppress("Some other server message"), "Unrelated messages stay visible");
        for(int i=0;i<599;i++) check(!feedback.tick(), "Do not expire early");
        check(feedback.tick(), "Return deferred warning on timeout");
        check(!feedback.suppress(WARNING), "Fallback login remains usable after timeout");
        feedback.start(); feedback.confirmed();
        check(!feedback.tick(), "Success cancels timeout");
        check(!feedback.suppress(WARNING), "Success ends suppression");
        feedback.start(); feedback.reset();
        check(!feedback.suppress(WARNING), "Disconnect clears pending state");
        System.out.println("Login feedback: exact warning, genuine errors, timeout fallback, success/disconnect PASS");
    }
    private static void check(boolean ok,String message) {if(!ok) throw new AssertionError(message);}
}
