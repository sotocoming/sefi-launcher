package ru.sotocoming.inputdiag;
import com.google.gson.*;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import ru.sotocoming.inputdiag.mixin.KeyBindingAccess;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;

public final class ReportData {
 private static final Gson GSON=new GsonBuilder().setPrettyPrinting().create();
 private static final Gson COMPACT=new Gson();
 public static final String[] CONFIGS={"fallingtrees/client.json","fallingtrees/common.json","fallingtrees_client.json","fallingtrees_common.json","entityculling.json","sodium-options.json","MouseTweaks.cfg"};
 public static final Set<String> INPUT_KEYS=Set.of("event","seq","utc","elapsed_us","physical_lmb","physical_rmb","left_shift","right_shift","left_ctrl","right_ctrl","focused","attack_pressed","attack_queued","use_pressed","sneak_pressed","sprint_pressed","screen","player_present","player_instance","dead","world_present","amecs_current_modifiers","code","action","glfw_modifiers","requested_attack_pressed","caller_stack");
 public static final class Draft {
  public String title="",description="",steps="",message="";
  public boolean build=true,settings=true,errors=true,input=true,discord=true;
  public boolean sending;
  public long ticketId;
  public JsonObject prepared;
  public int revision;
  public void changed(){revision++;prepared=null;message="";}
  public void clear(){title="";description="";steps="";ticketId=0;build=true;settings=true;errors=true;input=true;discord=true;sending=false;changed();}
 }
 public static final Draft DRAFT=new Draft();
 public static CompletableFuture<JsonObject> collect(MinecraftClient client,Draft draft){
  if(draft.prepared!=null)return CompletableFuture.completedFuture(draft.prepared);
  final int revision=draft.revision;
  final boolean build=draft.build,settings=draft.settings,errors=draft.errors,input=draft.input && InputTrace.hasRecording();
  JsonObject body=new JsonObject();body.addProperty("id",UUID.randomUUID().toString());body.addProperty("title",draft.title.trim());body.addProperty("description",draft.description.trim());body.addProperty("steps",draft.steps.trim());body.addProperty("discord",draft.discord || draft.ticketId>0);if(draft.ticketId>0)body.addProperty("ticket_id",draft.ticketId);
  JsonArray selected=new JsonArray();if(build)selected.add("build");if(settings)selected.add("settings");if(errors)selected.add("errors");if(input)selected.add("input");body.add("sections",selected);
  JsonObject diagnostic=new JsonObject(),runtime=new JsonObject();JsonArray mods=new JsonArray(),enabled=new JsonArray(),available=new JsonArray(),bindings=new JsonArray();
  Map<JsonObject,Path> jarPaths=new LinkedHashMap<>();
  if(build){
   FabricLoader.getInstance().getAllMods().forEach(mod->{JsonObject m=new JsonObject();m.addProperty("id",mod.getMetadata().getId());m.addProperty("version",mod.getMetadata().getVersion().getFriendlyString());mods.add(m);
    try {if(mod.getOrigin().getKind().name().equals("PATH")){for(Path p:mod.getOrigin().getPaths())if(Files.isRegularFile(p) && p.toString().endsWith(".jar")){jarPaths.put(m,p);break;}}}catch(RuntimeException ignored){}
   });
   client.getResourcePackManager().getEnabledProfiles().forEach(p->enabled.add(p.getName()));
   client.getResourcePackManager().getProfiles().forEach(p->available.add(p.getName()));
   JsonObject graphics=new JsonObject();try{graphics.addProperty("renderer",org.lwjgl.opengl.GL11.glGetString(org.lwjgl.opengl.GL11.GL_RENDERER));graphics.addProperty("opengl_version",org.lwjgl.opengl.GL11.glGetString(org.lwjgl.opengl.GL11.GL_VERSION));graphics.addProperty("graphics_mode",client.options.getGraphicsMode().getValue().toString());}catch(RuntimeException | LinkageError ignored){graphics.addProperty("available",false);}runtime.add("graphics",graphics);
   runtime.add("mods",mods);runtime.add("enabled_resource_packs",enabled);runtime.add("available_resource_packs",available);runtime.addProperty("java_version",System.getProperty("java.version"));runtime.addProperty("os",System.getProperty("os.name"));runtime.addProperty("reporter_version","0.2.0");
  }
  if(settings)for(KeyBinding k:client.options.allKeys){
   if(!(k==client.options.attackKey || k==client.options.sneakKey || k==client.options.sprintKey || k.getTranslationKey().startsWith("key.jei.") || k.getTranslationKey().startsWith("key.mousewheelie.")))continue;
   JsonObject b=new JsonObject();b.addProperty("name",k.getTranslationKey());b.addProperty("key",((KeyBindingAccess)k).inputdiag$boundKey().getTranslationKey());b.addProperty("modifiers",InputTrace.bindingModifiers(k));bindings.add(b);
  }
  JsonObject context=new JsonObject();if(settings && client.player!=null){context.addProperty("held_item",net.minecraft.registry.Registries.ITEM.getId(client.player.getMainHandStack().getItem()).toString());context.addProperty("sneaking",client.player.isSneaking());if(client.crosshairTarget instanceof net.minecraft.util.hit.BlockHitResult hit && client.world!=null)context.addProperty("target_block",net.minecraft.registry.Registries.BLOCK.getId(client.world.getBlockState(hit.getBlockPos()).getBlock()).toString());}
  JsonObject effectiveTrees=new JsonObject();
  if(settings){try{Class<?> ft=Class.forName("me.pandamods.fallingtrees.config.FallingTreesConfig");effectiveTrees.add("client",sanitize(GSON.toJsonTree(ft.getMethod("getClientConfig").invoke(null))));effectiveTrees.add("common",sanitize(GSON.toJsonTree(ft.getMethod("getCommonConfig").invoke(null))));}catch(ReflectiveOperationException | RuntimeException ignored){effectiveTrees.addProperty("available",false);}}
  Path root=FabricLoader.getInstance().getGameDir(),recording=InputTrace.recordingFile();
  return CompletableFuture.supplyAsync(()->{
   try{
    if(build){Map<Path,String> hashes=new HashMap<>();for(var e:jarPaths.entrySet()){String hash=hashes.get(e.getValue());if(hash==null){hash=sha256(e.getValue());hashes.put(e.getValue(),hash);}e.getKey().addProperty("sha256",hash);}Path inventory=root.resolve("resourcepacks/Homestead GUI/assets/minecraft/textures/gui/container/inventory.png");if(readable(root,inventory,4*1024*1024))runtime.addProperty("homestead_gui_inventory_sha256",sha256(inventory));diagnostic.add("build",runtime);}
    if(settings){JsonObject settingsData=new JsonObject(),configs=new JsonObject();for(String rel:CONFIGS){Path p=root.resolve("config").resolve(rel);if(!readable(root,p,128*1024))continue;
     if(rel.endsWith(".json")){try{configs.add(rel,sanitize(JsonParser.parseString(Files.readString(p))));}catch(JsonParseException ignored){JsonObject invalid=new JsonObject();invalid.addProperty("parse_error",true);configs.add(rel,invalid);}}
     else{JsonObject cfg=new JsonObject();for(String line:Files.readAllLines(p)){String[] pair=line.split("=",2);if(pair.length==2 && pair[0].matches("[A-Za-z]{1,40}") && pair[1].matches("[0-9-]{1,12}"))cfg.addProperty(pair[0],pair[1]);}configs.add(rel,cfg);}
    }settingsData.add("configs",configs);settingsData.add("bindings",bindings);settingsData.add("effective_fallingtrees",effectiveTrees);settingsData.add("context",context);diagnostic.add("settings",settingsData);}
    if(errors){JsonArray messages=new JsonArray();Path p=root.resolve("logs/latest.log");if(readable(root,p,8*1024*1024)){List<String> lines=Files.readAllLines(p);for(String line:lines.subList(Math.max(0,lines.size()-1200),lines.size())){
      if(!(line.contains("/WARN]")||line.contains("/ERROR]")) || line.matches("(?i).*(chat|sefi[.]report|sefi[.]ticket|token|password|secret|cookie|session|authorization|bearer|https?://|[A-Z]:\\\\|/home/).*"))continue;
      messages.add(line.substring(0,Math.min(line.length(),800)));if(messages.size()>=120)break;
    }}diagnostic.add("errors",messages);}
    if(input){JsonArray records=new JsonArray();if(recording!=null && readable(root,recording,8*1024*1024)){List<String> lines=Files.readAllLines(recording);for(String line:lines.subList(Math.max(0,lines.size()-1200),lines.size())){try{JsonObject row=JsonParser.parseString(line).getAsJsonObject(),out=new JsonObject();if(!row.has("physical_lmb"))continue;for(String key:INPUT_KEYS)if(row.has(key))out.add(key,row.get(key));records.add(out);}catch(JsonParseException ignored){}}}diagnostic.add("input",records);}
    body.add("diagnostics",diagnostic);
    if(COMPACT.toJson(body).getBytes(StandardCharsets.UTF_8).length>768*1024)throw new IllegalStateException("Отчёт слишком большой. Снимите часть приложений.");
    return body;
   }catch(Exception e){throw new java.util.concurrent.CompletionException(e);}
  }).thenApply(result->{client.execute(()->{if(draft.revision==revision)draft.prepared=result;});return result;});
 }
 private static boolean readable(Path root,Path file,long max)throws java.io.IOException{
  if(!file.normalize().startsWith(root.normalize()))return false;
  Path current=root;for(Path part:root.relativize(file)){current=current.resolve(part);if(Files.isSymbolicLink(current))return false;}
  return Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS) && Files.size(file)<=max;
 }
 private static String sha256(Path p)throws Exception{
  MessageDigest digest=MessageDigest.getInstance("SHA-256");try(var stream=Files.newInputStream(p)){byte[] buf=new byte[65536];int n;while((n=stream.read(buf))!=-1)digest.update(buf,0,n);}return HexFormat.of().formatHex(digest.digest());
 }
 private static JsonElement sanitize(JsonElement el){
  if(el.isJsonObject()){JsonObject out=new JsonObject();el.getAsJsonObject().entrySet().forEach(e->{if(!e.getKey().matches("(?i).*(token|password|secret|cookie|credential|chat).*"))out.add(e.getKey(),sanitize(e.getValue()));});return out;}
  if(el.isJsonArray()){JsonArray out=new JsonArray();el.getAsJsonArray().forEach(v->out.add(sanitize(v)));return out;}
  return el;
 }
 public record DeliveryResult(boolean sent,String message) {}
 public record Ticket(long id,String title,String status) {}
 private static HttpClient brokerHttp(){return HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).proxy(new java.net.ProxySelector(){public java.util.List<java.net.Proxy> select(URI uri){return java.util.List.of(java.net.Proxy.NO_PROXY);}public void connectFailed(URI uri,java.net.SocketAddress address,java.io.IOException error){}}).connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();}
 public static CompletableFuture<List<Ticket>> openTickets(){return CompletableFuture.supplyAsync(()->{
  try{
   String port=System.getProperty("sefi.reportPort",""),key=System.getProperty("sefi.reportKey","");
   if(!port.matches("[0-9]{1,5}")||!key.matches("[0-9a-f]{64}"))throw new IllegalStateException();
   HttpRequest request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/sefi/report/tickets")).timeout(Duration.ofSeconds(20)).header("Content-Type","application/json").header("X-SEFI-Report-Key",key).GET().build();
   HttpResponse<java.io.InputStream> response=brokerHttp().send(request,HttpResponse.BodyHandlers.ofInputStream());
   byte[] raw;try(var stream=response.body()){raw=stream.readNBytes(65537);}
   if(response.statusCode()!=200||raw.length>65536)throw new IllegalStateException();
   JsonArray list=JsonParser.parseString(new String(raw,StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("tickets");if(list==null||list.size()>30)throw new IllegalStateException();
   List<Ticket> result=new ArrayList<>();for(JsonElement value:list){JsonObject t=value.getAsJsonObject();long id=t.get("id").getAsLong();String title=t.get("title").getAsString(),status=t.get("status_label").getAsString();if(id<=0||title.length()>80||status.length()>100)throw new IllegalStateException();result.add(new Ticket(id,title.replaceAll("§.|[\\p{Cntrl}]",""),status));}return List.copyOf(result);
  }catch(Exception error){throw new java.util.concurrent.CompletionException(new IllegalStateException("Не удалось загрузить заявки. Нужен вход в SEFI и обновлённый лаунчер."));}
 });}
 public static CompletableFuture<DeliveryResult> deliver(JsonObject body,boolean send){return CompletableFuture.supplyAsync(()->{
  try{
   Path root=FabricLoader.getInstance().getGameDir(),dir=root.resolve("sefi-reports");if(Files.isSymbolicLink(dir))throw new IllegalStateException("Папка отчётов недоступна.");Files.createDirectories(dir);
   Path file=dir.resolve(body.get("id").getAsString()+".json"),temp=dir.resolve(body.get("id").getAsString()+".tmp");Files.writeString(temp,GSON.toJson(body),StandardCharsets.UTF_8,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING);
   if(!send)return new DeliveryResult(false,"Копия сохранена в папке игры: sefi-reports.");
   String port=System.getProperty("sefi.reportPort",""),key=System.getProperty("sefi.reportKey","");
   if(!port.matches("[0-9]{1,5}") || !key.matches("[0-9a-f]{64}"))return new DeliveryResult(false,"Копия сохранена. Для отправки нужен обновлённый SEFI Launcher.");
   HttpRequest request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/sefi/report")).timeout(Duration.ofSeconds(25)).header("Content-Type","application/json").header("X-SEFI-Report-Key",key).POST(HttpRequest.BodyPublishers.ofString(COMPACT.toJson(body))).build();
   HttpResponse<String> response=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).proxy(new java.net.ProxySelector(){public java.util.List<java.net.Proxy> select(URI uri){return java.util.List.of(java.net.Proxy.NO_PROXY);}public void connectFailed(URI uri,java.net.SocketAddress address,java.io.IOException error){}}).connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build().send(request,HttpResponse.BodyHandlers.ofString());
   JsonObject result=JsonParser.parseString(response.body()).getAsJsonObject();
   if(response.statusCode()!=200 || !result.has("ok") || !result.get("ok").getAsBoolean()){
    String error=result.has("error") && result.get("error").isJsonPrimitive()?result.get("error").getAsString():"Не отправлено. Копия сохранена; повторите позже.";
    return new DeliveryResult(false,error.substring(0,Math.min(error.length(),500)));
   }
   if(result.has("ticket_id")&&!result.get("ticket_id").isJsonNull())return new DeliveryResult(true,(body.has("ticket_id")?"Дополнение принято для заявки #":"Отчёт принят. Discord-тикет #")+result.get("ticket_id").getAsLong()+". Бот обработает его в канале заявки.");
   String notice=result.has("ticket_error") && !result.get("ticket_error").isJsonNull()?result.get("ticket_error").getAsString():"";
   return new DeliveryResult(true,"Отчёт отправлен. Номер: "+body.get("id").getAsString().substring(0,8)+(notice.isBlank()?"":". "+notice.substring(0,Math.min(notice.length(),300))));
  }catch(Exception e){return new DeliveryResult(false,"Не удалось отправить. Если копия сохранена, она в sefi-reports; повторите позже.");}
 });}
 public static String preview(JsonObject body){return GSON.toJson(body);}
}
