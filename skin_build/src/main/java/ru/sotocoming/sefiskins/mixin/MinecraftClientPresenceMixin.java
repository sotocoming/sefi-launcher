package ru.sotocoming.sefiskins.mixin;

import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.sotocoming.sefiskins.PresenceTelemetry;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientPresenceMixin {
    @Inject(method = "tick", at = @At("RETURN"))
    private void sefi$presence(CallbackInfo info) {
        PresenceTelemetry.tick((MinecraftClient)(Object)this);
    }
}
