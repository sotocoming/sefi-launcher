const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const jdk=[process.env.JAVA_HOME,'C:/Program Files/Java/jdk-21'].find(p=>p&&fs.existsSync(path.join(p,'bin/javac.exe')));if(!jdk)throw Error('JDK with javac required');
const output=path.join(root,'mod_build/build/auth-client-tests');fs.mkdirSync(output,{recursive:true});
const names=['VoiceChatReconnect','LauncherLoginFeedback','TrustedServerAddresses'];
execFileSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',output,...names.flatMap(n=>[path.join(root,`mod_build/src/main/java/ru/sotocoming/sefiauth/${n}.java`),path.join(root,`mod_build/tests/${n}Test.java`)])],{stdio:'inherit'});
for(const n of names)execFileSync(path.join(jdk,'bin/java.exe'),['-cp',output,`ru.sotocoming.sefiauth.${n}Test`],{stdio:'inherit'});
