import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readGitFileList} from './git-file-list.mjs';

const root=resolve(import.meta.dirname,'..');
const version=(await readFile(join(root,'vite.config.ts'),'utf8')).match(/const buildVersion = '(\d+)'/)?.[1];
assert.ok(version,'Missing web build version');
const stage=await mkdtemp(join(tmpdir(),'cbt-android-preview-'));
const android=join(stage,'android');
const run=(binary,args,cwd,extra={})=>execFileSync(binary,args,{cwd,stdio:'inherit',env:{...process.env,...extra}});
try {
  // Stage the Android source only. Release keystores and generated projects stay outside the build.
  const tracked=await readGitFileList({cwd:root});
  for(const name of tracked){
    if(!name.startsWith('android/') || name.startsWith('android/signing/') || !existsSync(join(root,name)))continue;
    const target=join(stage,name);
    await mkdir(resolve(target,'..'),{recursive:true});
    await copyFile(join(root,name),target);
  }
  await symlink(join(root,'node_modules'),join(stage,'node_modules'),'dir');
  await copyFile(join(root,'package.json'),join(stage,'package.json'));
  await writeFile(join(stage,'capacitor.config.json'),JSON.stringify({
    appId:'com.tk6871.cbt.preview',appName:'CBT 미리보기',webDir:'web',
    backgroundColor:'#0d1622',plugins:{StatusBar:{overlaysWebView:true,style:'LIGHT',backgroundColor:'#00000000'}},
  }));
  const strings=join(android,'app/src/main/res/values/strings.xml');
  let labels=await readFile(strings,'utf8');
  labels=labels.replace(/(<string name="(?:app_name|title_activity_main)">)[^<]+/g,'$1CBT 미리보기');
  await writeFile(strings,labels.replaceAll('com.tk6871.cbt','com.tk6871.cbt.preview'));
  run(process.execPath,['tools/build-android-web.mjs','--bundled-preview',join(stage,'web')],root);
  run(process.execPath,[join(root,'node_modules/@capacitor/cli/bin/capacitor'),'sync','android'],stage);
  const java=process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
  const sdk=process.env.ANDROID_HOME || join(process.env.HOME,'Library/Android/sdk');
  run(process.platform==='win32'?'gradlew.bat':'./gradlew',['assembleDebug','-PcbtPreviewVersion='+version],android,{JAVA_HOME:java,ANDROID_HOME:sdk});
  const apk=join(android,'app/build/outputs/apk/debug/app-debug.apk');
  const dir=join(root,'dist');
  await mkdir(dir,{recursive:true});
  const out=join(dir,'industrial-cbt-v'+version+'-preview.apk');
  const partial=out+'.'+process.pid+'.tmp';
  try {await copyFile(apk,partial);await rename(partial,out);}
  finally {await rm(partial,{force:true});}
  console.log(out);
} finally {await rm(stage,{recursive:true,force:true});}
