import ru.sotocoming.inputdiag.ReportData;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
public class ReportTicketContract {
 public static void main(String[] args)throws Exception {
  var body=new AtomicReference<>("{\"tickets\":[{\"id\":7,\"title\":\"§cМоя заявка\",\"status_label\":\"В работе\"}]}");
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  var calls=new java.util.concurrent.atomic.AtomicInteger();
  server.createContext("/sefi/report/tickets",e->{calls.incrementAndGet();if(!e.getRequestMethod().equals("GET")||!"a".repeat(64).equals(e.getRequestHeaders().getFirst("X-SEFI-Report-Key")))throw new AssertionError();byte[] data=body.get().getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});server.start();
  try{
   System.setProperty("sefi.reportPort",String.valueOf(server.getAddress().getPort()));System.setProperty("sefi.reportKey","a".repeat(64));
   var tickets=ReportData.openTickets().get();if(tickets.size()!=1||tickets.get(0).id()!=7||!tickets.get(0).title().equals("Моя заявка"))throw new AssertionError("validated and sanitized list");
   body.set("{\"tickets\":[]}");if(!ReportData.openTickets().get().isEmpty())throw new AssertionError("empty list");
   for(String invalid:new String[]{"{\"tickets\":[{\"id\":-1,\"title\":\"bad\",\"status_label\":\"bad\"}]}","x".repeat(65537),"not JSON"}){body.set(invalid);boolean rejected=false;try{ReportData.openTickets().get();}catch(java.util.concurrent.ExecutionException expected){rejected=true;}if(!rejected)throw new AssertionError("invalid response accepted");}
   int before=calls.get();System.clearProperty("sefi.reportKey");boolean rejected=false;try{ReportData.openTickets().get();}catch(java.util.concurrent.ExecutionException expected){rejected=true;}if(!rejected||calls.get()!=before)throw new AssertionError("missing local key must not request");
   var draft=new ReportData.Draft();draft.ticketId=7;draft.prepared=new com.google.gson.JsonObject();draft.changed();if(draft.prepared!=null)throw new AssertionError("change invalidates review");draft.clear();if(draft.ticketId!=0)throw new AssertionError("clear resets destination");
   System.out.println("PASS: real ReportData class, loopback GET/key, populated/empty list, formatting sanitization, invalid/oversize response, missing key and review invalidation; no production request");
  }finally{server.stop(0);}
 }
}
