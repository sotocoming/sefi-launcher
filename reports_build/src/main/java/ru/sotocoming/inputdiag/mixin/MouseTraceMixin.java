package ru.sotocoming.inputdiag.mixin;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.sotocoming.inputdiag.InputTrace;
@Mixin(value=Mouse.class, priority=2000)
public class MouseTraceMixin {
 @Inject(method="onMouseButton", at=@At("HEAD"))
 private void inputdiag$head(long window,int button,int action,int modifiers,CallbackInfo ci) {
  if(button==0 || button==1) InputTrace.input("mouse_head",window,button,action,modifiers);
 }
 @Inject(method="onMouseButton", at=@At("RETURN"))
 private void inputdiag$return(long window,int button,int action,int modifiers,CallbackInfo ci) {
  if(button==0 || button==1) InputTrace.input("mouse_return",window,button,action,modifiers);
 }
}
