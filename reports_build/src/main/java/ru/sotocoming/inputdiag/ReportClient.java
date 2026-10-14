package ru.sotocoming.inputdiag;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.client.MinecraftClient;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.literal;
public final class ReportClient implements ClientModInitializer {
 @Override public void onInitializeClient(){
  ClientCommandRegistrationCallback.EVENT.register((dispatcher,registryAccess)->dispatcher.register(literal("report").executes(ctx->{MinecraftClient c=MinecraftClient.getInstance();c.execute(()->c.setScreen(new ReportScreen()));return 1;})));
 }
}
