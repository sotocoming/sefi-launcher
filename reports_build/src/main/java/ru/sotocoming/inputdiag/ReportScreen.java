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
  busy=draft.sending;
  formWidth=Math.min(440,width-24);left=(width-formWidth)/2;top=Math.max(6,(height-300)/2);
  int y=top+32;
  subject=addDrawableChild(new TextFieldWidget(textRenderer,left,y,formWidth,18,Text.literal("Коротко о проблеме")));subject.setMaxLength(80);subject.setText(draft.title);subject.setChangedListener(s->{draft.title=s;draft.changed();});
  y+=36;int areaHeight=Math.max(38,Math.min(85,height-188));
  description=addDrawableChild(new EditBoxWidget(textRenderer,left,y,formWidth,areaHeight,Text.literal("Что случилось?"),Text.literal("Описание")));description.setMaxLength(2500);description.setText(draft.description);description.setChangeListener(s->{draft.description=s;draft.changed();});
  y+=areaHeight+18;
  steps=addDrawableChild(new TextFieldWidget(textRenderer,left,y,formWidth,18,Text.literal("Как повторить (необязательно)")));steps.setMaxLength(500);steps.setText(draft.steps);steps.setChangedListener(s->{draft.steps=s;draft.changed();});
  y+=24;int half=(formWidth-6)/2;
  addDrawableChild(ButtonWidget.builder(Text.literal("Приложения ("+((draft.build?1:0)+(draft.settings?1:0)+(draft.errors?1:0)+(draft.input?1:0))+")…"),b->{if(!busy)client.setScreen(new OptionsScreen(this));}).dimensions(left,y,half,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Посмотреть данные"),b->prepare(false,true)).dimensions(left+half+6,y,half,20).build());
  y+=24;
  addDrawableChild(ButtonWidget.builder(Text.literal("Отправить"),b->prepare(true,false)).dimensions(left,y,half,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Сохранить копию"),b->prepare(false,false)).dimensions(left+half+6,y,half,20).build());
  statusY=y+25;subject.active=!busy;steps.active=!busy;description.active=!busy;setInitialFocus(subject);
 }
 private void release(){
  draft.sending=false;busy=false;subject.active=true;steps.active=true;description.active=true;
  if(client.currentScreen instanceof ReportScreen report && report!=this){report.busy=false;report.clearAndInit();}
 }
 private void prepare(boolean send,boolean preview){
  if(busy || draft.sending)return;
  if(draft.title.trim().length()<3 || draft.description.trim().length()<10){draft.message="Заполните тему (от 3 символов) и описание (от 10).";return;}
  // Freeze the selected trace before preview/send so the displayed attachment
  // and an idempotent retry always refer to the same recording snapshot.
  if(draft.input && InputTrace.isRecording()){InputTrace.stopRecording();draft.changed();}
  busy=true;draft.sending=true;subject.active=false;steps.active=false;description.active=false;draft.message="Подготовка выбранных данных…";
  java.util.concurrent.CompletableFuture<JsonObject> gathering;
  try{gathering=ReportData.collect(client,draft);}catch(RuntimeException | LinkageError error){draft.message="Часть диагностики недоступна. Снимите приложения и попробуйте снова.";release();return;}
  gathering.whenComplete((body,error)->client.execute(()->{
   if(error!=null){draft.message="Не удалось собрать данные. Снимите часть приложений.";release();return;}
   draft.prepared=body;
   if(preview){release();client.setScreen(new PreviewScreen(this,body));return;}
   ReportData.deliver(body,send).thenAccept(result->client.execute(()->{
    if(result.sent()){
     draft.clear();InputTrace.clearRecording();
     client.inGameHud.getChatHud().addMessage(Text.literal("[SEFI] "+result.message()));
     release();
     if(client.currentScreen instanceof ReportScreen)client.setScreen(null);
    }else{draft.message=result.message();release();}
   }));
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
  ctx.drawTextWrapped(textRenderer,Text.literal(draft.message.isEmpty()?"Приложится: "+(draft.build?"сборка; ":"")+(draft.settings?"настройки; ":"")+(draft.errors?"ошибки; ":"")+(draft.input?"кнопки; ":"")+"без чата и паролей.":draft.message),left,statusY,formWidth,0xBBBBBB);
 }
 private static final class OptionsScreen extends Screen {
  private final ReportScreen parent;private int x,y,w;
  private ButtonWidget recording;
  OptionsScreen(ReportScreen parent){super(Text.literal("Что приложить"));this.parent=parent;}
  @Override protected void init(){
   w=Math.min(420,width-24);x=(width-w)/2;y=Math.max(8,(height-230)/2);int row=y+25;
   toggle("Версии модов и ресурс-паки",0,row);toggle("Настройки модов и управления",1,row+24);toggle("Ошибки игры (без чата)",2,row+48);toggle("Создать тикет в Discord",4,row+96);
   recording=addDrawableChild(ButtonWidget.builder(Text.empty(),b->client.setScreen(new RecordingScreen(this))).dimensions(x,row+72,w,20).build());updateRecording();
   addDrawableChild(ButtonWidget.builder(Text.literal("Готово"),b->close()).dimensions(x,y+205,w,20).build());
  }
  private void updateRecording(){recording.setMessage(Text.literal(!InputTrace.hasRecording()?"Кнопки: записи нет — настроить…":"Кнопки: "+(InputTrace.isRecording()?"идёт запись":"запись готова")+(parent.draft.input?" · приложится":" · не приложится")));}
  @Override public void tick(){updateRecording();}
  private void toggle(String label,int kind,int yy){
   addDrawableChild(ButtonWidget.builder(Text.literal((value(kind)?"☑ ":"☐ ")+label),b->{boolean next=!value(kind);switch(kind){case 0->parent.draft.build=next;case 1->parent.draft.settings=next;case 2->parent.draft.errors=next;case 3->parent.draft.input=next;case 4->parent.draft.discord=next;}parent.draft.changed();b.setMessage(Text.literal((next?"☑ ":"☐ ")+label));}).dimensions(x,yy,w,20).build());
  }
  private boolean value(int kind){return switch(kind){case 0->parent.draft.build;case 1->parent.draft.settings;case 2->parent.draft.errors;case 3->parent.draft.input;default->parent.draft.discord;};}
  @Override public void close(){client.setScreen(parent);}
  @Override public boolean shouldPause(){return false;}
  @Override public void render(DrawContext ctx,int mx,int my,float delta){renderBackground(ctx);ctx.drawTextWithShadow(textRenderer,title,x,y+4,0xFFFFFF);super.render(ctx,mx,my,delta);ctx.drawTextWrapped(textRenderer,Text.literal("Кнопки записываются только после нажатия «Начать запись». Статус записи и вложения — в отдельном окне."),x,y+155,w,0xBBBBBB);}
 }
 private static final class RecordingScreen extends Screen {
  private final OptionsScreen parent;private int x,y,w;
  private ButtonWidget record,attach;
  RecordingScreen(OptionsScreen parent){super(Text.literal("Запись кнопок для отчёта"));this.parent=parent;}
  @Override protected void init(){
   w=Math.min(440,width-24);x=(width-w)/2;y=Math.max(8,(height-230)/2);
   record=addDrawableChild(ButtonWidget.builder(Text.empty(),b->{
    if(InputTrace.isRecording())InputTrace.stopRecording();
    else {InputTrace.beginRecording();parent.parent.draft.input=InputTrace.hasRecording();}
    parent.parent.draft.changed();updateButtons();
   }).dimensions(x,y+62,w,20).build());
   attach=addDrawableChild(ButtonWidget.builder(Text.empty(),b->{parent.parent.draft.input=!parent.parent.draft.input;parent.parent.draft.changed();updateButtons();}).dimensions(x,y+88,w,20).build());
   int half=(w-6)/2;
   addDrawableChild(ButtonWidget.builder(Text.literal("В игру"),b->client.setScreen(null)).dimensions(x,y+205,half,20).build());
   addDrawableChild(ButtonWidget.builder(Text.literal("Назад к отчёту"),b->client.setScreen(parent.parent)).dimensions(x+half+6,y+205,half,20).build());
   updateButtons();
  }
  private void updateButtons(){
   record.setMessage(Text.literal(InputTrace.isRecording()?"Остановить запись (данные сохранятся)":InputTrace.hasRecording()?"Записать заново (заменить запись)":"Начать запись — до 2 минут"));
   attach.active=InputTrace.hasRecording();
   attach.setMessage(Text.literal(!InputTrace.hasRecording()?"Прикладывать пока нечего":parent.parent.draft.input?"Запись приложится · Не прикладывать":"Запись не приложится · Приложить"));
  }
  private static String time(long seconds){return String.format(java.util.Locale.ROOT,"%d:%02d",seconds/60,seconds%60);}
  @Override public void tick(){updateButtons();}
  @Override public void close(){client.setScreen(parent);}
  @Override public boolean shouldPause(){return false;}
  @Override public void render(DrawContext ctx,int mx,int my,float delta){
   renderBackground(ctx);ctx.drawTextWithShadow(textRenderer,title,x,y+4,0xFFFFFF);
   String state=InputTrace.isRecording()?"Идёт запись · осталось "+time(InputTrace.remainingSeconds()):InputTrace.hasRecording()?"Запись остановлена · сохранено "+time(InputTrace.recordedSeconds()):"Запись выключена · данных пока нет";
   ctx.drawTextWithShadow(textRenderer,Text.literal(state),x,y+27,InputTrace.isRecording()?0xFFCC66:0xBBBBBB);
   ctx.drawTextWithShadow(textRenderer,Text.literal("Вложение: "+(!InputTrace.hasRecording()?"нет данных":parent.parent.draft.input?"будет в отчёте":"не будет в отчёте")),x,y+43,0xBBBBBB);
   super.render(ctx,mx,my,delta);
   ctx.drawTextWrapped(textRenderer,Text.literal("Начните запись → «В игру» → повторите баг → /report. Остановка сохраняет запись. «Не прикладывать» меняет только вложение."),x,y+120,w,0xBBBBBB);
   ctx.drawTextWrapped(textRenderer,Text.literal("ЛКМ/ПКМ, Shift/Ctrl и состояние управления. Без вводимого текста. Через 2 минуты запись остановится сама."),x,y+160,w,0x999999);
   ctx.drawTextWithShadow(textRenderer,Text.literal("Предпросмотр и отправка завершают запись."),x,y+187,0x999999);
  }
 }
 private static final class PreviewScreen extends Screen {
  private final ReportScreen parent;private final JsonObject body;
  PreviewScreen(ReportScreen parent,JsonObject body){super(Text.literal("Данные отчёта"));this.parent=parent;this.body=body;}
  @Override protected void init(){int w=Math.min(540,width-24),x=(width-w)/2;EditBoxWidget box=new EditBoxWidget(textRenderer,x,28,w,height-66,Text.empty(),title){
    @Override public boolean charTyped(char chr,int mods){return false;}
    @Override public boolean keyPressed(int key,int scan,int mods){return (key==262||key==263||key==264||key==265||key==268||key==269||key==266||key==267||(Screen.hasControlDown()&&(key==65||key==67))) && super.keyPressed(key,scan,mods);}
   };box.setMaxLength(3000000);box.setText(ReportData.preview(body));box.setChangeListener(s->{});addDrawableChild(box);addDrawableChild(ButtonWidget.builder(Text.literal("Назад"),b->close()).dimensions(x,height-30,w,20).build());}
  @Override public void close(){client.setScreen(parent);}
  @Override public boolean shouldPause(){return false;}
  @Override public void render(DrawContext ctx,int mx,int my,float delta){renderBackground(ctx);ctx.drawCenteredTextWithShadow(textRenderer,title,width/2,12,0xFFFFFF);super.render(ctx,mx,my,delta);}
 }
}
