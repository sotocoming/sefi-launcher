package ru.sotocoming.sefiauth;
public class TrustedServerAddressesTest {
    public static void main(String[] args) {
        String configured = "main.example.org:25565,eu.example.org:25566";
        if (!TrustedServerAddresses.contains(configured, "MAIN.example.org")) throw new AssertionError("Primary");
        if (!TrustedServerAddresses.contains(configured, "eu.example.org:25566")) throw new AssertionError("EURO");
        for (String address : new String[]{"eu.example.org", "eu.example.org:25567", "main.example.org.evil.org", "evil.org", ""}) {
            if (TrustedServerAddresses.contains(configured, address)) throw new AssertionError(address);
        }
        String fallback = "mc.sotocoming.ru,77.90.13.212,minecraft.sotocoming.ru,193.124.66.117:25566";
        if (!TrustedServerAddresses.contains(fallback, "77.90.13.212:25565")) throw new AssertionError("Reserve primary IP");
        if (!TrustedServerAddresses.contains(fallback, "193.124.66.117:25566")) throw new AssertionError("Reserve alternate IP");
        if (TrustedServerAddresses.contains(fallback, "193.124.66.117:25565")) throw new AssertionError("Wrong reserve port");
        if (TrustedServerAddresses.contains("", "evil.org")) throw new AssertionError("Empty config");
        System.out.println("PASS: primary/EURO allowed, other hosts and ports denied");
    }
}
