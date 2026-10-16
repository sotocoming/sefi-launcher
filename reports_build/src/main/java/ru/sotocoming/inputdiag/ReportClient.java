package ru.sotocoming.inputdiag;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.literal;
public final class ReportClient implements ClientModInitializer {
 private boolean openRequested;
 @Override public void onInitializeClient(){
  // ChatScreen closes itself after executing a command. Open the form after that
  // input handler returns; MinecraftClient.execute runs inline on the client thread.
  ClientCommandRegistrationCallback.EVENT.register((dispatcher,registryAccess)->dispatcher.register(literal("report").executes(ctx->{openRequested=true;return 1;})));
  ClientTickEvents.END_CLIENT_TICK.register(client->{
   if(openRequested){openRequested=false;client.setScreen(new ReportScreen());}
  });
 }
}
