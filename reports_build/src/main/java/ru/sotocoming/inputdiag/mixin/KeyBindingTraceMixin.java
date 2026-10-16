package ru.sotocoming.inputdiag.mixin;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.sotocoming.inputdiag.InputTrace;
@Mixin(KeyBinding.class)
public class KeyBindingTraceMixin {
 @Inject(method="setPressed",at=@At("HEAD"))
 private void inputdiag$setPressed(boolean pressed,CallbackInfo ci) {
  MinecraftClient c=MinecraftClient.getInstance();
  if(c!=null && c.options!=null && (Object)this==c.options.attackKey && c.options.attackKey.isPressed()!=pressed)
   InputTrace.attackChange(pressed);
 }
}
