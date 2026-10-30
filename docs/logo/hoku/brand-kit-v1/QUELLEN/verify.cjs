const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'EXPORT-CHECKS.json'),'utf8'));
const failures=[];
const originalChecks=fs.existsSync(path.join(root,'ORIGINAL-CHECKS.json'))?JSON.parse(fs.readFileSync(path.join(root,'ORIGINAL-CHECKS.json'),'utf8')):[];
for(const p of [...manifest.pngs,...originalChecks]){
 const bytes=fs.readFileSync(path.join(root,p.file));
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')failures.push(p.file+': invalid PNG');
 if(bytes.readUInt32BE(16)!==p.width||bytes.readUInt32BE(20)!==p.height)failures.push(p.file+': wrong dimensions');
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==p.sha256)failures.push(p.file+': hash mismatch');
}
const ico=fs.readFileSync(path.join(root,'04-Icons/favicon.ico'));
if(ico.readUInt16LE(0)!==0||ico.readUInt16LE(2)!==1||ico.readUInt16LE(4)!==4)failures.push('ICO header');
for(let i=0;i<4;i++){
 const p=6+i*16,size=ico[p],length=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12),png=ico.subarray(offset,offset+length);
 if(png.length!==length||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)failures.push('ICO entry '+i);
}
for(const file of ['Michroma-Regular.ttf','IBMPlexMono-Medium.ttf','Michroma-OFL.txt','IBMPlexMono-OFL.txt'])if(fs.statSync(path.join(root,'05-Schriften',file)).size<1000)failures.push(file);
const view=manifest.compactEqualHeights;
if(Math.abs(view.HOKU-view.Hoku)>.00001)failures.push('compact unequal heights');
if(Math.abs(manifest.equalWidths.HOKU-manifest.equalWidths.HEALTH_HUB)>.00001)failures.push('unequal caption widths');
if(failures.length)throw new Error(failures.join('\n'));
console.log(JSON.stringify({pngsVerified:manifest.pngs.length+originalChecks.length,originalsVerified:originalChecks.length,icoEntriesVerified:4,fontFilesVerified:4,compactEqualHeights:view.HOKU,failures:0}));
