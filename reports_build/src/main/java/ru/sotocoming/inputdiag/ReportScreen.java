package ru.sotocoming.inputdiag;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.*;
import net.minecraft.text.Text;
import com.google.gson.JsonObject;

public final class ReportScreen extends Screen {
 private final ReportData.Draft draft=ReportData.DRAFT;
 private TextFieldWidget subject,steps;
 private EditBoxWidget description;
 private boolean busy;
 private int left,top,formWidth,statusY;
 public ReportScreen(){super(Text.literal("Сообщить о проблеме"));}
 @Override protected void init(){
  formWidth=Math.min(440,width-24);left=(width-formWidth)/2;top=Math.max(6,(height-300)/2);
  int y=top+32;
  subject=addDrawableChild(new TextFieldWidget(textRenderer,left,y,formWidth,18,Text.literal("Коротко о проблеме")));subject.setMaxLength(80);subject.setText(draft.title);subject.setChangedListener(s->{draft.title=s;draft.changed();});
  y+=36;int areaHeight=Math.max(38,Math.min(85,height-188));
  description=addDrawableChild(new EditBoxWidget(textRenderer,left,y,formWidth,areaHeight,Text.literal("Что случилось?"),Text.literal("Описание")));description.setMaxLength(2500);description.setText(draft.description);description.setChangeListener(s->{draft.description=s;draft.changed();});
  y+=areaHeight+18;
  steps=addDrawableChild(new TextFieldWidget(textRenderer,left,y,formWidth,18,Text.literal("Как повторить (необязательно)")));steps.setMaxLength(500);steps.setText(draft.steps);steps.setChangedListener(s->{draft.steps=s;draft.changed();});
  y+=24;int half=(formWidth-6)/2;
  addDrawableChild(ButtonWidget.builder(Text.literal("Приложения…"),b->{if(!busy)client.setScreen(new OptionsScreen(this));}).dimensions(left,y,half,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Посмотреть данные"),b->prepare(false,true)).dimensions(left+half+6,y,half,20).build());
  y+=24;
  addDrawableChild(ButtonWidget.builder(Text.literal("Отправить"),b->prepare(true,false)).dimensions(left,y,half,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Сохранить копию"),b->prepare(false,false)).dimensions(left+half+6,y,half,20).build());
  statusY=y+25;setInitialFocus(subject);
 }
 private void prepare(boolean send,boolean preview){
  if(busy)return;
  if(draft.title.trim().length()<3 || draft.description.trim().length()<10){draft.message="Заполните тему (от 3 символов) и описание (от 10).";return;}
  busy=true;subject.active=false;steps.active=false;description.active=false;draft.message="Подготовка выбранных данных…";
  ReportData.collect(client,draft).whenComplete((body,error)->client.execute(()->{
   if(error!=null){busy=false;subject.active=true;steps.active=true;description.active=true;draft.message="Не удалось собрать данные. Снимите часть приложений.";return;}
   draft.prepared=body;
   if(preview){busy=false;subject.active=true;steps.active=true;description.active=true;client.setScreen(new PreviewScreen(this,body));return;}
   ReportData.deliver(body,send).thenAccept(message->client.execute(()->{busy=false;subject.active=true;steps.active=true;description.active=true;draft.message=message;}));
  }));
 }
 @Override public void tick(){subject.tick();steps.tick();description.tick();}
 @Override public boolean shouldPause(){return false;}
 @Override public void render(DrawContext ctx,int mx,int my,float delta){
  renderBackground(ctx);ctx.fill(left-8,top-4,left+formWidth+8,Math.min(height, statusY+27),0xE0181820);
  ctx.drawTextWithShadow(textRenderer,title,left,top+2,0xFFFFFF);
  ctx.drawTextWithShadow(textRenderer,Text.literal("Коротко о проблеме"),left,subject.getY()-12,0xBBBBBB);
  ctx.drawTextWithShadow(textRenderer,Text.literal("Описание"),left,description.getY()-12,0xBBBBBB);
  ctx.drawTextWithShadow(textRenderer,Text.literal("Как повторить (необязательно)"),left,steps.getY()-12,0xBBBBBB);
  super.render(ctx,mx,my,delta);
  ctx.drawTextWrapped(textRenderer,Text.literal(draft.message.isEmpty()?"Приложится только выбранная диагностика. Чат и пароли не собираются.":draft.message),left,statusY,formWidth,0xBBBBBB);
 }
 private static final class OptionsScreen extends Screen {
  private final ReportScreen parent;private int x,y,w;
  OptionsScreen(ReportScreen parent){super(Text.literal("Что приложить"));this.parent=parent;}
  @Override protected void init(){
   w=Math.min(420,width-24);x=(width-w)/2;y=Math.max(8,(height-230)/2);int row=y+25;
   toggle("Версии модов и ресурс-паки",0,row);toggle("Настройки модов и управления",1,row+24);toggle("Ошибки игры (без чата)",2,row+48);toggle("Запись кнопок",3,row+72);toggle("Создать тикет в Discord",4,row+96);
   addDrawableChild(ButtonWidget.builder(Text.literal(InputTrace.isRecording()?"Остановить запись":"Записать кнопки (2 минуты)"),b->{if(InputTrace.isRecording())InputTrace.stopRecording();else InputTrace.beginRecording();parent.draft.input=true;parent.draft.changed();clearAndInit();}).dimensions(x,row+123,w,20).build());
   addDrawableChild(ButtonWidget.builder(Text.literal("Готово"),b->close()).dimensions(x,y+205,w,20).build());
  }
  private void toggle(String label,int kind,int yy){
   addDrawableChild(ButtonWidget.builder(Text.literal((value(kind)?"☑ ":"☐ ")+label),b->{boolean next=!value(kind);switch(kind){case 0->parent.draft.build=next;case 1->parent.draft.settings=next;case 2->parent.draft.errors=next;case 3->parent.draft.input=next;case 4->parent.draft.discord=next;}parent.draft.changed();b.setMessage(Text.literal((next?"☑ ":"☐ ")+label));}).dimensions(x,yy,w,20).build());
  }
  private boolean value(int kind){return switch(kind){case 0->parent.draft.build;case 1->parent.draft.settings;case 2->parent.draft.errors;case 3->parent.draft.input;default->parent.draft.discord;};}
  @Override public void close(){client.setScreen(parent);}
  @Override public boolean shouldPause(){return false;}
  @Override public void render(DrawContext ctx,int mx,int my,float delta){renderBackground(ctx);ctx.drawTextWithShadow(textRenderer,title,x,y+4,0xFFFFFF);super.render(ctx,mx,my,delta);ctx.drawTextWrapped(textRenderer,Text.literal("Запись выключена по умолчанию. Включите её, закройте форму, повторите баг и снова откройте /report."),x,y+176,w,0xBBBBBB);}
 }
 private static final class PreviewScreen extends Screen {
  private final ReportScreen parent;private final JsonObject body;
  PreviewScreen(ReportScreen parent,JsonObject body){super(Text.literal("Данные отчёта"));this.parent=parent;this.body=body;}
  @Override protected void init(){int w=Math.min(540,width-24),x=(width-w)/2;EditBoxWidget box=new EditBoxWidget(textRenderer,x,28,w,height-66,Text.empty(),title){
    @Override public boolean charTyped(char chr,int mods){return false;}
    @Override public boolean keyPressed(int key,int scan,int mods){return (key==262||key==263||key==264||key==265||key==268||key==269||key==266||key==267||(Screen.hasControlDown()&&key==67)) && super.keyPressed(key,scan,mods);}
   };box.setMaxLength(800000);box.setText(ReportData.preview(body));box.setChangeListener(s->{});addDrawableChild(box);addDrawableChild(ButtonWidget.builder(Text.literal("Назад"),b->close()).dimensions(x,height-30,w,20).build());}
  @Override public void close(){client.setScreen(parent);}
  @Override public boolean shouldPause(){return false;}
  @Override public void render(DrawContext ctx,int mx,int my,float delta){renderBackground(ctx);ctx.drawCenteredTextWithShadow(textRenderer,title,width/2,12,0xFFFFFF);super.render(ctx,mx,my,delta);}
 }
}
