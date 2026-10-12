package ru.sotocoming.sefiauth;
public class LoginRetryTest {
 public static void main(String[] args) {
  LoginRetry r=new LoginRetry(); r.start(0); check(r.tick(0)); check(!r.tick(29999)); check(!r.tick(30000)); check(!r.tick(31499)); check(r.tick(31500));
  r.fail(32000,true); check(!r.tick(33499)); check(r.tick(33500)); r.fail(34000,true); check(!r.active()); check(!r.tick(100000));
  r.start(100000); check(r.tick(100000)); r.fail(100001,false); check(!r.active()); check(!r.tick(200000));
  r.start(200000); check(r.tick(200000)); r.reset(); check(!r.active()); check(!r.tick(300000));
  r.start(900000); check(r.tick(900000)); check(r.attempt()==1); r.reset();
  System.out.println("Login retry: deadline, backoff, three attempts, permanent rejection, disconnect, long menu wait PASS");
 }
 static void check(boolean ok) { if(!ok) throw new AssertionError(); }
}
