package ru.sotocoming.inputdiag.mixin;
import net.minecraft.client.Keyboard;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.sotocoming.inputdiag.InputTrace;
@Mixin(value=Keyboard.class,priority=2000)
public class KeyboardTraceMixin {
 private static boolean inputdiag$tracked(int k) {
  return k==GLFW.GLFW_KEY_LEFT_SHIFT || k==GLFW.GLFW_KEY_RIGHT_SHIFT
   || k==GLFW.GLFW_KEY_LEFT_CONTROL || k==GLFW.GLFW_KEY_RIGHT_CONTROL;
 }
 @Inject(method="onKey",at=@At("HEAD"))
 private void inputdiag$head(long w,int k,int scan,int action,int mods,CallbackInfo ci) {
  if(inputdiag$tracked(k) && action!=GLFW.GLFW_REPEAT) InputTrace.input("key_head",w,k,action,mods);
 }
 @Inject(method="onKey",at=@At("RETURN"))
 private void inputdiag$return(long w,int k,int scan,int action,int mods,CallbackInfo ci) {
  if(inputdiag$tracked(k) && action!=GLFW.GLFW_REPEAT) InputTrace.input("key_return",w,k,action,mods);
 }
}
