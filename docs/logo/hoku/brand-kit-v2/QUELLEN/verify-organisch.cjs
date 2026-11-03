const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),folder='09-Organisch-Cyan';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const assert=(c,m)=>{if(!c)throw Error(m);};
module.exports=function verifyOrganic(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'ORGANISCH-CHECKS.json'),'utf8'));
 const read=file=>fs.readFileSync(path.join(root,file));
 const approved=read('../entwuerfe/hoku-app-icon-organisch-cyan-v3.png');
 assert(hash(approved)===manifest.approvedMasterSha256,'Organic approval differs from manifest');
 for(const file of ['QUELLEN/hoku-app-icon-organisch-cyan-v3-master.png',`${folder}/hoku-organisch-cyan-original.png`])assert(hash(read(file))===hash(approved),'Organic original changed: '+file);
 assert(hash(read('QUELLEN/hoku-organisch-cyan-freigestellt-master.png'))===manifest.cutoutSha256,'Organic cutout changed');
 for(const file of manifest.files){
  const b=read(file.file);assert(b.length===file.bytes&&hash(b)===file.sha256,'Organic file changed: '+file.file);
  if(file.file.endsWith('.png')){
   assert(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a','Invalid PNG: '+file.file);
   assert(b.readUInt32BE(16)===file.width&&b.readUInt32BE(20)===file.height,'PNG dimensions: '+file.file);
   if(file.file.includes('/01-App-Icons/')||file.file.includes('/04-Favicons/'))assert(b[25]===2,'App/favicon must be opaque RGB: '+file.file);
  }
  if(file.file.endsWith('.svg')){const s=b.toString();assert(s.includes('data:image/png;base64,'),'SVG lacks raster master');assert(!s.includes('file:///'),'Nonportable SVG');}
  if(file.file.endsWith('.pdf'))assert(b.subarray(0,5).toString()==='%PDF-'&&b.toString('latin1').includes('/Subtype /Image'),'PDF must contain artwork');
  if(file.file.endsWith('.jpg'))assert(b.subarray(0,3).toString('hex')==='ffd8ff','Invalid JPEG');
  if(file.file.endsWith('.webp'))assert(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP','Invalid WebP');
 }
 for(const size of manifest.sizes){const b=read(`${folder}/01-App-Icons/hoku-app-organisch-cyan-${size}.png`);assert(b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size,'Missing app size: '+size);}
 const maskable=read(`${folder}/01-App-Icons/hoku-app-organisch-cyan-maskable-512.png`);
 const masked=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image width="512" height="512" href="data:image/png;base64,${maskable.toString('base64')}"/></svg>`,{font:{loadSystemFonts:false}}).render().pixels;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const p=(y*512+x)*4;if(Math.max(masked[p],masked[p+1],masked[p+2])>=60)assert(Math.hypot(x+.5-256,y+.5-256)<=204.8,'Organic maskable safe area exceeded');}
 for(const tone of ['cyan','weiss','schwarz']){
  const file=`${folder}/02-Symbole/hoku-organisch-${tone}-transparent-512.png`,b=read(file);
  const p=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image width="512" height="512" href="data:image/png;base64,${b.toString('base64')}"/></svg>`).render().pixels;
  assert(p[3]===0,'Organic corner not transparent');
  assert(p[(Math.floor(512*.44)*512+Math.floor(512*.57))*4+3]===0,'Organic pupil not transparent');
  let visible=0;
  for(let i=0;i<p.length;i+=4)if(p[i+3]){visible++;if(tone!=='cyan')assert(p[i]===p[i+1]&&p[i+1]===p[i+2],tone+' is not monochrome');}
  assert(visible>1000,'Organic symbol is empty');
 }
 const ico=read(`${folder}/04-Favicons/favicon.ico`),count=ico.readUInt16LE(4);
 assert(ico.readUInt16LE(2)===1&&count===7,'Organic ICO header');
 for(let i=0;i<count;i++){const p=6+i*16,size=ico[p]||256,len=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12),b=ico.subarray(offset,offset+len);assert(hash(b)===hash(read(`${folder}/04-Favicons/hoku-favicon-organisch-${size}.png`)),'Organic ICO entry differs: '+size);}
 const result={organicFilesVerified:manifest.files.length,approvedOriginalExact:true,appSizes:manifest.sizes.length,transparentSymbols:3,pdfs:4,faviconEntries:7};
 console.log(JSON.stringify(result));return result;
};
if(require.main===module)module.exports();
