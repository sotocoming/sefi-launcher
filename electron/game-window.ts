import {app, BrowserWindow, Tray, Menu, nativeImage, dialog} from 'electron';
import path from 'path';
/** Keep login/report/Discord brokers alive when the game window owns the session. */
export class GameWindow {
  running = false;
  hidden = false;
  quitting = false;
  private tray: Tray | null = null;
  constructor(private window: () => BrowserWindow | null) {}
  show(){const w=this.window();if(!w||w.isDestroyed())return;if(w.isMinimized())w.restore();w.show();w.focus();}
  private ensureTray(): boolean {
    if(this.tray)return true;
    try {
      const icon=app.isPackaged?path.join(process.resourcesPath,'brand/icon.ico'):path.join(app.getAppPath(),'build/icon.png');
      const image=nativeImage.createFromPath(icon);if(image.isEmpty())return false;
      this.tray=new Tray(image);this.tray.setToolTip('SEFI Launcher · Minecraft запущен');
      this.tray.on('click',()=>this.show());
      this.tray.setContextMenu(Menu.buildFromTemplate([{label:'Открыть SEFI Launcher',click:()=>this.show()},{type:'separator'},
        {label:'Завершить лаунчер',click:()=>void this.requestQuit()}]));
      return true;
    } catch {this.tray?.destroy();this.tray=null;return false;}
  }
  hide(){const w=this.window();if(!w||w.isDestroyed())return;this.hidden=true;if(this.ensureTray())w.hide();else w.minimize();}
  close(event: {preventDefault():void}){if(this.running&&!this.quitting){event.preventDefault();this.hide();}}
  state(status: string){
    const wasRunning=this.running;
    if(status==='running'){this.running=true;this.ensureTray();}
    if(status==='idle'||status==='error'){
      this.running=false;
      if(this.hidden||(status==='error'&&wasRunning))this.show();
      this.hidden=false;this.tray?.destroy();this.tray=null;
    }
  }
  async requestQuit(){
    if(this.running){const result=await dialog.showMessageBox({type:'question',title:'Завершить SEFI Launcher?',message:'Minecraft ещё работает',detail:'Автовход, отправка отчётов и статус Discord перестанут работать до следующего запуска лаунчера.',buttons:['Оставить лаунчер','Завершить'],defaultId:0,cancelId:0});if(result.response!==1)return;}
    this.quitting=true;app.quit();
  }
  dispose(){this.quitting=true;this.tray?.destroy();this.tray=null;}
}
