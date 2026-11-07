const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'EXPORT-CHECKS.json'),'utf8'));
const vertical=fs.existsSync(path.join(root,'VERTIKAL-CHECKS.json'))?JSON.parse(fs.readFileSync(path.join(root,'VERTIKAL-CHECKS.json'),'utf8')):null;
const dark=fs.existsSync(path.join(root,'APP-DUNKEL-CHECKS.json'))?JSON.parse(fs.readFileSync(path.join(root,'APP-DUNKEL-CHECKS.json'),'utf8')):null;
const organic=fs.existsSync(path.join(root,'ORGANISCH-CHECKS.json'))?JSON.parse(fs.readFileSync(path.join(root,'ORGANISCH-CHECKS.json'),'utf8')):null;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const allPngs=[...new Map([...manifest.pngs,...(vertical?.pngs||[]),...(dark?.pngs||[]),...(organic?.files.filter(p=>p.file.endsWith('.png'))||[])].map(p=>[p.file,p])).values()];
for(const p of allPngs){
 const b=fs.readFileSync(path.join(root,p.file));
 assert(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a',p.file+': invalid PNG');
 assert(b.readUInt32BE(16)===p.width&&b.readUInt32BE(20)===p.height,p.file+': dimensions');
 assert(hash(b)===p.sha256,p.file+': changed bytes');
}
const original=fs.readFileSync(path.join(root,'../entwuerfe/hoku-app-icon-cyan-natuerliche-pupille-v1.png'));
for(const file of ['QUELLEN/hoku-app-icon-cyan-master.png','04-Icons/hoku-app-cyan-original.png'])assert(hash(fs.readFileSync(path.join(root,file)))===hash(original),'Approved master changed: '+file);
assert(hash(original)===manifest.masterSha256,'Wrong manifest master');
const source=fs.readFileSync(path.join(root,'QUELLEN/hoku-cyan-freigestellt-master.png'));
assert(hash(source)===manifest.sourceSha256,'Transparent source changed');
const {width,height}=manifest.sourceDimensions;
const render=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${source.toString('base64')}"/></svg>`).render();
const rgba=render.pixels;
const alphaAt=(x,y)=>rgba[(Math.floor(y*height)*width+Math.floor(x*width))*4+3];
assert(alphaAt(.57,.44)===0,'Pupil is not transparent');
assert(alphaAt(.01,.01)===0,'Background is not transparent');
for(const item of manifest.kiHashes){
 const current=fs.readFileSync(path.join(root,item.file)),previous=fs.readFileSync(path.join(root,'../brand-kit-v1',item.file));
 assert(hash(current)===item.sha256&&hash(current)===hash(previous),'KI symbol modified: '+item.file);
}
assert(Math.abs(manifest.equalWidths.HOKU-manifest.equalWidths.HEALTH_HUB)<.00001,'Subtitle widths differ');
assert(Math.abs(manifest.compactEqualHeights.HOKU-manifest.compactEqualHeights.Hoku)<.00001,'Compact heights differ');
assert(Math.abs(manifest.fullEqualHeights.text-manifest.fullEqualHeights.Hoku)<.00001,'Full logo heights differ');
if(vertical){
 const master=fs.readFileSync(path.join(root,'QUELLEN/hoku-vertikal-v6-master.png'));
 assert(hash(master)===vertical.approvedMasterSha256,'Vertical approved master changed');
 assert(hash(fs.readFileSync(path.join(root,'QUELLEN/hoku-vertikal-v6-master.svg')))===vertical.approvedSvgSha256,'Vertical SVG master changed');
 assert(hash(fs.readFileSync(path.join(root,'08-Vertikal-und-Plaketten/hoku-vertikal-v6-cyan-1360.png')))===hash(master),'Variant 6 export differs from approval');
 assert(Math.abs(vertical.equalWidths.HOKU-vertical.equalWidths.HEALTH_HUB)<=2,'Vertical line widths differ');
}
if(dark){
 const master=fs.readFileSync(path.join(root,'QUELLEN/hoku-app-icon-cyan-dunkel-master.png'));
 assert(hash(master)===dark.approvedMasterSha256,'Dark approved master changed');
 assert(hash(fs.readFileSync(path.join(root,'04-Icons/Dunkel/hoku-app-cyan-dunkel-original.png')))===hash(master),'Dark original changed');
 const projectSource=path.join(root,'../exports/hoku-app-icon-cyan-dunkel-v1.png');
 if(fs.existsSync(projectSource))assert(hash(fs.readFileSync(projectSource))===hash(master),'Dark source differs from approval');
 for(const size of dark.sizes){const b=fs.readFileSync(path.join(root,`04-Icons/Dunkel/hoku-app-cyan-dunkel-${size}.png`));assert(b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size&&b[25]===2,'Dark RGB/dimension mismatch: '+size);}
 const ico=fs.readFileSync(path.join(root,'04-Icons/Dunkel/favicon.ico'));assert(hash(ico)===dark.icoSha256&&ico.readUInt16LE(2)===1&&ico.readUInt16LE(4)===4,'Dark favicon ICO');
 for(let i=0;i<4;i++){const p=6+i*16,size=ico[p],len=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12),b=ico.subarray(offset,offset+len);assert(b.length===len&&b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size&&b[25]===2,'Dark favicon entry '+i);}
}
const ico=fs.readFileSync(path.join(root,'04-Icons/favicon.ico'));
assert(ico.readUInt16LE(0)===0&&ico.readUInt16LE(2)===1&&ico.readUInt16LE(4)===4,'ICO header');
for(let i=0;i<4;i++){const p=6+i*16,size=ico[p],len=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12),b=ico.subarray(offset,offset+len);assert(b.length===len&&b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size,'ICO entry '+i);}
for(const file of ['Michroma-Regular.ttf','IBMPlexMono-Medium.ttf','Michroma-OFL.txt','IBMPlexMono-OFL.txt'])assert(fs.statSync(path.join(root,'05-Schriften',file)).size>1000,'Missing font/license: '+file);
const html=fs.readFileSync(path.join(root,'HOKU-Brand-Guide.html'),'utf8');
for(const match of html.matchAll(/href="([^"]+)"/g))assert(fs.existsSync(path.join(root,match[1])),'Broken guide link: '+match[1]);
assert(!html.includes('Blau–Violett')&&!html.includes('hoku-app-blau'),'Stale branding in guide');
if(fs.existsSync(path.join(root,'ORGANISCH-CHECKS.json')))require('./verify-organisch.cjs')();
console.log(JSON.stringify({pngsVerified:allPngs.length,approvedMasterExact:true,verticalVariant6Exact:!!vertical,darkIconSizes:dark?.sizes.length||0,darkRgbWithoutAlpha:!!dark,transparentPupil:true,kiFilesUnchanged:manifest.kiHashes.length,fontsAndLicenses:4,icoEntries:dark?8:4,guideLinks:'passed',failures:0}));
