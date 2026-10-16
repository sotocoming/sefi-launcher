package ru.sotocoming.inputdiag.mixin;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(KeyBinding.class)
public interface KeyBindingAccess {
 @Accessor("boundKey") InputUtil.Key inputdiag$boundKey();
 @Accessor("timesPressed") int inputdiag$timesPressed();
}
