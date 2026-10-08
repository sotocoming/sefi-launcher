package ru.sotocoming.sefiskins.mixin;
import ru.sotocoming.sefiskins.CommunitySkins;
import ru.sotocoming.sefiskins.SkinIdentity;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.minecraft.MinecraftProfileTexture;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import java.util.Map;

@Mixin(PlayerListEntry.class)
public abstract class PlayerListEntryMixin {
    @Shadow @Final private GameProfile profile;
    @Shadow @Final private Map<MinecraftProfileTexture.Type, Identifier> textures;
    @Unique private CommunitySkins.Skin sefi$skin() {
        // Vanilla/session textures always win, including official skins on offline-mode servers.
        if (!SkinIdentity.accepts(profile.getId(), profile.getName(),
            textures.containsKey(MinecraftProfileTexture.Type.SKIN) || profile.getProperties().containsKey("textures"))) return null;
        return CommunitySkins.get(profile);
    }
    @Inject(method="getSkinTexture", at=@At("RETURN"), cancellable=true)
    private void sefi$texture(CallbackInfoReturnable<Identifier> result) {
        var skin = sefi$skin(); if (skin != null) result.setReturnValue(skin.texture());
    }
    @Inject(method="getModel", at=@At("RETURN"), cancellable=true)
    private void sefi$model(CallbackInfoReturnable<String> result) {
        var skin = sefi$skin(); if (skin != null) result.setReturnValue(skin.model());
    }
    @Inject(method="hasSkinTexture", at=@At("RETURN"), cancellable=true)
    private void sefi$hasSkin(CallbackInfoReturnable<Boolean> result) {
        if (sefi$skin() != null) result.setReturnValue(true);
    }
}
