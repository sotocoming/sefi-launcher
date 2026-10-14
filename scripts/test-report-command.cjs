// Compile the real entrypoint against a tiny client event harness. Reproduces
// ChatScreen's close-after-command behavior, including inline client.execute.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sefi-report-command-'));
const sources = {
 'net/fabricmc/api/ClientModInitializer.java': `package net.fabricmc.api; public interface ClientModInitializer { void onInitializeClient(); }`,
 'net/minecraft/client/MinecraftClient.java': `package net.minecraft.client;
 public class MinecraftClient { public static final MinecraftClient INSTANCE=new MinecraftClient(); public Object screen;
 public static MinecraftClient getInstance(){return INSTANCE;} public void execute(Runnable r){r.run();} public void setScreen(Object s){screen=s;} }`,
 'net/fabricmc/fabric/api/client/command/v2/ClientCommandManager.java': `package net.fabricmc.fabric.api.client.command.v2;
 public class ClientCommandManager { public interface Command { int run(Object ctx); }
 public static class Builder { public Command command; public Builder executes(Command c){command=c;return this;} }
 public static Builder literal(String name){return new Builder();} }`,
 'net/fabricmc/fabric/api/client/command/v2/ClientCommandRegistrationCallback.java': `package net.fabricmc.fabric.api.client.command.v2;
 public interface ClientCommandRegistrationCallback { void register(Dispatcher dispatcher,Object registry); Event EVENT=new Event();
 class Dispatcher { public ClientCommandManager.Command command; public void register(ClientCommandManager.Builder b){command=b.command;} }
 class Event { public Dispatcher dispatcher=new Dispatcher(); public void register(ClientCommandRegistrationCallback cb){cb.register(dispatcher,null);} } }`,
 'net/fabricmc/fabric/api/client/event/lifecycle/v1/ClientTickEvents.java': `package net.fabricmc.fabric.api.client.event.lifecycle.v1;
 import net.minecraft.client.MinecraftClient;
 public class ClientTickEvents { public interface Tick { void tick(MinecraftClient c); } public static final Event END_CLIENT_TICK=new Event();
 public static class Event { public Tick listener; public void register(Tick l){listener=l;} public void fire(){listener.tick(MinecraftClient.INSTANCE);} } }`,
 'ru/sotocoming/inputdiag/ReportScreen.java': `package ru.sotocoming.inputdiag; public class ReportScreen { }`,
 'ReportCommandTimingTest.java': `import ru.sotocoming.inputdiag.*;
 import net.minecraft.client.MinecraftClient;
 import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
 import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
 public class ReportCommandTimingTest { public static void main(String[] args){
 new ReportClient().onInitializeClient(); MinecraftClient c=MinecraftClient.INSTANCE;
 c.setScreen(new Object()); ClientCommandRegistrationCallback.EVENT.dispatcher.command.run(null);
 c.setScreen(null); // ChatScreen closes after sending the command.
 ClientTickEvents.END_CLIENT_TICK.fire();
 if(!(c.screen instanceof ReportScreen))throw new AssertionError("Form was closed by ChatScreen");
 Object nextScreen=new Object();c.setScreen(nextScreen);ClientTickEvents.END_CLIENT_TICK.fire();
 if(c.screen!=nextScreen)throw new AssertionError("Form reopens without another command");
 ClientCommandRegistrationCallback.EVENT.dispatcher.command.run(null);c.setScreen(null);ClientTickEvents.END_CLIENT_TICK.fire();
 if(!(c.screen instanceof ReportScreen))throw new AssertionError("Second command does not reopen form");
 System.out.println("PASS: /report survives ChatScreen closure, opens once and can reopen"); } }`,
};
const sourcePaths=[];
for(const [name,content] of Object.entries(sources)) {
 const file=path.join(temp,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);sourcePaths.push(file);
}
const bin=process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME,'bin') : '';
const javaExe=name=>bin ? path.join(bin,name+(process.platform==='win32'?'.exe':'')) : name;
execFileSync(javaExe('javac'),['--release','17','-d',path.join(temp,'classes'),...sourcePaths,path.join(root,'reports_build/src/main/java/ru/sotocoming/inputdiag/ReportClient.java')],{stdio:'inherit'});
execFileSync(javaExe('java'),['-cp',path.join(temp,'classes'),'ReportCommandTimingTest'],{stdio:'inherit'});
