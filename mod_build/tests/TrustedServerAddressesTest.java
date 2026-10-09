package ru.sotocoming.sefiauth;
public class TrustedServerAddressesTest {
    public static void main(String[] args) {
        String configured = "main.example.org:25565,eu.example.org:25566";
        if (!TrustedServerAddresses.contains(configured, "MAIN.example.org")) throw new AssertionError("Primary");
        if (!TrustedServerAddresses.contains(configured, "eu.example.org:25566")) throw new AssertionError("EURO");
        for (String address : new String[]{"eu.example.org", "eu.example.org:25567", "main.example.org.evil.org", "evil.org", ""}) {
            if (TrustedServerAddresses.contains(configured, address)) throw new AssertionError(address);
        }
        if (TrustedServerAddresses.contains("", "evil.org")) throw new AssertionError("Empty config");
        System.out.println("PASS: primary/EURO allowed, other hosts and ports denied");
    }
}
