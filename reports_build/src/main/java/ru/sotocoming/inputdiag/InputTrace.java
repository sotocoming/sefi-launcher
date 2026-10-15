package ru.sotocoming.inputdiag;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.sotocoming.inputdiag.mixin.KeyBindingAccess;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.lang.reflect.Method;

public final class InputTrace implements ClientModInitializer {
 private static final Logger LOG=LoggerFactory.getLogger("SEFI-InputDiagnostics");
 private static final Gson GSON=new Gson();
 private static final long START=System.nanoTime(), LIMIT=8L*1024*1024;
 private static BufferedWriter writer;
 private static long bytes,sequence,ticks;
 private static String previousStart="",previousEnd="";
 private static boolean active;
 private static Path traceFile;
 private static long traceDeadline;
 private static Method boundModifiers,modifierGet;
 private static java.lang.reflect.Field currentModifiers;
 private static Object[] modifierValues;
 @Override public void onInitializeClient() {
  try {
   try {
    Class<?> utils=Class.forName("de.siphalor.amecs.api.KeyBindingUtils");
    Class<?> mods=Class.forName("de.siphalor.amecs.api.KeyModifiers");
    Class<?> mod=Class.forName("de.siphalor.amecs.api.KeyModifier");
    boundModifiers=utils.getMethod("getBoundModifiers",KeyBinding.class);
    modifierGet=mods.getMethod("get",mod);
    modifierValues=mod.getEnumConstants();
    currentModifiers=Class.forName("de.siphalor.amecs.impl.AmecsAPI").getField("CURRENT_MODIFIERS");
   } catch(ReflectiveOperationException ignored) { }
   JsonObject info=new JsonObject(),versions=new JsonObject();
   info.addProperty("purpose","input state only; no chat, credentials or coordinates");
   for(String id:new String[]{"minecraft","fabricloader","keybind_fix","amecsapi","mousewheelie","jei","mousetweaks","malilib"})
    FabricLoader.getInstance().getModContainer(id).ifPresent(m->versions.addProperty(id,m.getMetadata().getVersion().getFriendlyString()));
   info.add("versions",versions);write("session_start",info);
   ClientTickEvents.START_CLIENT_TICK.register(c->{if(active && System.nanoTime()>traceDeadline) close();safe(()->{if(ticks++==0) bindings(c);observe(c,"tick_start");});});
   ClientTickEvents.END_CLIENT_TICK.register(c->safe(()->observe(c,"tick_end")));
   Runtime.getRuntime().addShutdownHook(new Thread(InputTrace::close,"sefi-input-trace-close"));
  } catch(Exception e) {LOG.warn("Trace could not start; gameplay unchanged",e);close();}
 }
 public static synchronized void beginRecording() {
  close();
  try {
   Path dir=FabricLoader.getInstance().getGameDir().resolve("logs/input-diagnostics");Files.createDirectories(dir);
   String stamp=DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS").withZone(ZoneOffset.UTC).format(Instant.now());
   traceFile=dir.resolve("input-"+stamp+".jsonl");
   writer=Files.newBufferedWriter(traceFile,StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW);
   bytes=0;sequence=0;ticks=0;previousStart="";previousEnd="";traceDeadline=System.nanoTime()+120_000_000_000L;active=true;
   LOG.info("Player enabled input diagnostics for up to 2 minutes");
  } catch(Exception e) {traceFile=null;LOG.warn("Unable to start input recording",e);close();}
 }
 public static String bindingModifiers(KeyBinding key){return modifiers(key);}
 public static boolean isRecording(){return active;}
 public static Path recordingFile(){return traceFile;}
 public static void stopRecording(){close();}
 public static synchronized void clearRecording(){close();traceFile=null;}
 public static void input(String event,long window,int code,int action,int mods) {
  safe(()->inputImpl(event,window,code,action,mods));
 }
 private static void inputImpl(String event,long window,int code,int action,int mods) {
  if(!active) return;
  MinecraftClient c=MinecraftClient.getInstance();
  if(c.getWindow()==null || window!=c.getWindow().getHandle()) return;
  JsonObject d=state(c);
  d.addProperty("code",code);
  d.addProperty("action",action==GLFW.GLFW_PRESS?"press":action==GLFW.GLFW_RELEASE?"release":"repeat");
  d.addProperty("glfw_modifiers",mods);write(event,d);
 }
 private static void observe(MinecraftClient c,String event) {
  if(!active) return;
  JsonObject d=state(c);String s=d.toString();
  String previous=event.equals("tick_start")?previousStart:previousEnd;
  if(!s.equals(previous) || (event.equals("tick_end") && ticks%100==0)) write(event,d);
  if(event.equals("tick_start")) previousStart=s;else previousEnd=s;
 }
 private static JsonObject state(MinecraftClient c) {
  JsonObject d=new JsonObject();if(c.getWindow()==null || c.options==null) return d;
  long w=c.getWindow().getHandle();
  d.addProperty("physical_lmb",GLFW.glfwGetMouseButton(w,0)==GLFW.GLFW_PRESS);
  d.addProperty("physical_rmb",GLFW.glfwGetMouseButton(w,1)==GLFW.GLFW_PRESS);
  d.addProperty("left_shift",GLFW.glfwGetKey(w,GLFW.GLFW_KEY_LEFT_SHIFT)==GLFW.GLFW_PRESS);
  d.addProperty("right_shift",GLFW.glfwGetKey(w,GLFW.GLFW_KEY_RIGHT_SHIFT)==GLFW.GLFW_PRESS);
  d.addProperty("left_ctrl",GLFW.glfwGetKey(w,GLFW.GLFW_KEY_LEFT_CONTROL)==GLFW.GLFW_PRESS);
  d.addProperty("right_ctrl",GLFW.glfwGetKey(w,GLFW.GLFW_KEY_RIGHT_CONTROL)==GLFW.GLFW_PRESS);
  d.addProperty("focused",GLFW.glfwGetWindowAttrib(w,GLFW.GLFW_FOCUSED)==GLFW.GLFW_TRUE);
  d.addProperty("attack_pressed",c.options.attackKey.isPressed());
  d.addProperty("attack_queued",((KeyBindingAccess)c.options.attackKey).inputdiag$timesPressed());
  d.addProperty("use_pressed",c.options.useKey.isPressed());
  d.addProperty("sneak_pressed",c.options.sneakKey.isPressed());
  d.addProperty("sprint_pressed",c.options.sprintKey.isPressed());
  d.addProperty("screen",c.currentScreen==null?"gameplay":c.currentScreen.getClass().getName());
  d.addProperty("player_present",c.player!=null);
  d.addProperty("player_instance",c.player==null?0:System.identityHashCode(c.player));
  d.addProperty("dead",c.player!=null && c.player.isDead());
  d.addProperty("world_present",c.world!=null);
  if(currentModifiers!=null) {try {d.addProperty("amecs_current_modifiers",formatModifiers(currentModifiers.get(null)));} catch(ReflectiveOperationException ignored) {}}
  return d;
 }
 private static void bindings(MinecraftClient c) {
  for(KeyBinding k:c.options.allKeys) {
   InputUtil.Key b=((KeyBindingAccess)k).inputdiag$boundKey();
   if(k!=c.options.attackKey && k!=c.options.sneakKey && k!=c.options.sprintKey
    && !(b.getCategory()==InputUtil.Type.MOUSE && b.getCode()==0)) continue;
   JsonObject d=new JsonObject();d.addProperty("binding",k.getTranslationKey());
   d.addProperty("bound_key",b.getTranslationKey());d.addProperty("modifiers",modifiers(k));write("binding",d);
  }
 }
 private static String modifiers(KeyBinding k) {
  if(boundModifiers==null || modifierGet==null || modifierValues==null) return "unavailable";
  try {
   return formatModifiers(boundModifiers.invoke(null,k));
  } catch(ReflectiveOperationException e) {return "unavailable";}
 }
 private static String formatModifiers(Object mods) throws ReflectiveOperationException {
  StringBuilder out=new StringBuilder();
  for(Object mod:modifierValues) {
   String name=((Enum<?>)mod).name();if(name.equals("NONE")) continue;
   if(Boolean.TRUE.equals(modifierGet.invoke(mods,mod))) {if(out.length()>0) out.append('+');out.append(name);}
  }
  return out.length()==0?"NONE":out.toString();
 }
 public static void attackChange(boolean pressed) {safe(()->attackChangeImpl(pressed));}
 private static void attackChangeImpl(boolean pressed) {
  if(!active) return;
  JsonObject d=state(MinecraftClient.getInstance());d.addProperty("requested_attack_pressed",pressed);
  com.google.gson.JsonArray stack=new com.google.gson.JsonArray();
  for(StackTraceElement frame:Thread.currentThread().getStackTrace()) {
   String cls=frame.getClassName();
   if(cls.equals(Thread.class.getName()) || cls.equals(InputTrace.class.getName())) continue;
   stack.add(cls+"."+frame.getMethodName());if(stack.size()>=14) break;
  }
  d.add("caller_stack",stack);write("attack_change",d);
 }
 private static synchronized void write(String event,JsonObject d) {
  if(!active || writer==null) return;
  try {
   d.addProperty("event",event);d.addProperty("seq",++sequence);d.addProperty("utc",Instant.now().toString());
   d.addProperty("elapsed_us",(System.nanoTime()-START)/1000);
   String line=GSON.toJson(d);bytes+=line.getBytes(StandardCharsets.UTF_8).length+1;
   if(bytes>LIMIT) {LOG.info("Trace limit reached; logging stopped");close();return;}
   writer.write(line);writer.newLine();writer.flush();
  } catch(Exception e) {LOG.warn("Trace stopped after write error",e);close();}
 }
 private static void safe(Runnable task) {
  if(!active) return;
  try {task.run();} catch(RuntimeException | LinkageError e) {LOG.warn("Trace disabled after observation error; gameplay unchanged",e);close();}
 }
 private static synchronized void close() {
  active=false;if(writer!=null) {try {writer.close();} catch(Exception ignored) {} writer=null;}
 }
}
