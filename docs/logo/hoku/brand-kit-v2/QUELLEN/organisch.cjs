const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {Resvg}=require('@resvg/resvg-js');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {jsPDF}=require('jspdf');
const root=path.resolve(__dirname,'..'),folder='09-Organisch-Cyan';
const master=fs.readFileSync(path.join(__dirname,'hoku-app-icon-organisch-cyan-v3-master.png'));
const cutout=fs.readFileSync(path.join(__dirname,'hoku-organisch-cyan-freigestellt-master.png'));
const sizes=[16,20,24,29,32,40,48,58,60,64,72,76,80,87,96,120,128,144,152,167,180,192,256,512,1024];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const wrap=(size,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><title>HOKU Organisch Cyan</title>${body}</svg>`;
const render=svg=>new Resvg(svg,{font:{loadSystemFonts:svg.includes('<text'),defaultFontFamily:'Segoe UI'}}).render();
function bounds(bytes,alpha=false){
 const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20),url='data:image/png;base64,'+bytes.toString('base64');
 const p=render(wrap(w,`<image width="${w}" height="${h}" href="${url}"/>`)).pixels;
 let l=w,r=-1,t=h,b=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(alpha?p[i+3]>=128:Math.max(p[i],p[i+1],p[i+2])>=60){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
 if(r<l)throw Error('Empty source');
 return {w,h,url,cx:(l+r+1)/2,cy:(t+b+1)/2,diameter:Math.max(r-l+1,b-t+1)};
}
const opaqueSource=bounds(master),alphaSource=bounds(cutout,true);
function image(s,size,ratio,extra=''){
 const k=size*ratio/s.diameter;
 return `<image x="${size/2-s.cx*k}" y="${size/2-s.cy*k}" width="${s.w*k}" height="${s.h*k}" href="${s.url}" ${extra}/>`;
}
function appSvg(size,ratio=.84){return wrap(size,`<rect width="${size}" height="${size}" fill="#000101"/>`+image(opaqueSource,size,ratio));}
function symbolSvg(size,tone='cyan'){
 const v=tone==='weiss'?1:0;
 const filter=tone==='cyan'?'':`<defs><filter id="ink" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="gamma" amplitude="1" exponent="1.4" offset="0"/></feComponentTransfer><feColorMatrix type="matrix" values="0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 1 0"/></filter></defs>`;
 return wrap(size,filter+image(alphaSource,size,.84,tone==='cyan'?'':'filter="url(#ink)"'));
}
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(zlib.crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
function rgbPng(r){
 const pixels=r.pixels,rows=Buffer.alloc(r.height*(1+r.width*3));
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const p=(y*r.width+x)*4,q=y*(1+r.width*3)+1+x*3;if(pixels[p+3]!==255)throw Error('Opaque export contains alpha');rows[q]=pixels[p];rows[q+1]=pixels[p+1];rows[q+2]=pixels[p+2];}
 const h=Buffer.alloc(13);h.writeUInt32BE(r.width);h.writeUInt32BE(r.height,4);h[8]=8;h[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function ico(entries){
 const head=Buffer.alloc(6+entries.length*16);head.writeUInt16LE(1,2);head.writeUInt16LE(entries.length,4);let offset=head.length;
 entries.forEach(({size,png},i)=>{const p=6+i*16;head[p]=size===256?0:size;head[p+1]=size===256?0:size;head.writeUInt16LE(1,p+4);head.writeUInt16LE(24,p+6);head.writeUInt32LE(png.length,p+8);head.writeUInt32LE(offset,p+12);offset+=png.length;});
 return Buffer.concat([head,...entries.map(e=>e.png)]);
}
module.exports=async function buildOrganic(baseOverview){
 const files=[];
 function write(file,bytes){const content=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);files.push({file,bytes:content.length,sha256:hash(content),...(file.endsWith('.png')?{width:content.readUInt32BE(16),height:content.readUInt32BE(20),colorType:content[25]}:{})});return content;}
 const png=(file,svg,alpha=false)=>{const r=render(svg);return write(file,alpha?r.asPng():rgbPng(r));};
 write(`${folder}/hoku-organisch-cyan-original.png`,master);
 write(`${folder}/02-Symbole/hoku-organisch-cyan-transparent-original.png`,cutout);
 for(const size of sizes)png(`${folder}/01-App-Icons/hoku-app-organisch-cyan-${size}.png`,appSvg(size));
 png(`${folder}/01-App-Icons/hoku-app-organisch-cyan-maskable-512.png`,appSvg(512,.76));
 write(`${folder}/01-App-Icons/hoku-app-organisch-cyan.svg`,appSvg(1024));
 for(const tone of ['cyan','weiss','schwarz']){
  for(const size of [64,128,256,512,1024])png(`${folder}/02-Symbole/hoku-organisch-${tone}-transparent-${size}.png`,symbolSvg(size,tone),true);
  write(`${folder}/02-Symbole/hoku-organisch-${tone}-transparent.svg`,symbolSvg(1024,tone));
 }
 const favicons=[16,24,32,48,64,128,256].map(size=>({size,png:png(`${folder}/04-Favicons/hoku-favicon-organisch-${size}.png`,appSvg(size,.92))}));
 write(`${folder}/04-Favicons/favicon.ico`,ico(favicons));
 write(`${folder}/04-Favicons/favicon.svg`,appSvg(512,.92));
 const app1024=fs.readFileSync(path.join(root,`${folder}/01-App-Icons/hoku-app-organisch-cyan-1024.png`));
 const canvas=createCanvas(1024,1024),ctx=canvas.getContext('2d');
 ctx.drawImage(await loadImage(app1024),0,0);
 write(`${folder}/03-Formate/hoku-app-organisch-cyan.jpg`,canvas.toBuffer('image/jpeg',98));
 write(`${folder}/03-Formate/hoku-app-organisch-cyan.webp`,canvas.toBuffer('image/webp',100));
 for(const tone of ['cyan','weiss','schwarz']){
  ctx.clearRect(0,0,1024,1024);ctx.drawImage(await loadImage(fs.readFileSync(path.join(root,`${folder}/02-Symbole/hoku-organisch-${tone}-transparent-1024.png`))),0,0);
  write(`${folder}/03-Formate/hoku-organisch-${tone}-transparent.webp`,canvas.toBuffer('image/webp',100));
 }
 for(const tone of ['app','cyan','weiss','schwarz']){
  const bytes=tone==='app'?app1024:fs.readFileSync(path.join(root,`${folder}/02-Symbole/hoku-organisch-${tone}-transparent-1024.png`));
  const pdf=new jsPDF({unit:'pt',format:[600,600],compress:true});
  pdf.setProperties({title:`HOKU Organisch Cyan – ${tone}`,subject:'Rastermotiv, keine reine Vektorzeichnung',creator:'HOKU Brand-Kit'});
  pdf.setCreationDate(new Date('2026-11-03T00:00:00Z'));pdf.setFileId(hash(bytes).slice(0,32));
  pdf.addImage(new Uint8Array(bytes),'PNG',0,0,600,600,undefined,'FAST');
  write(`${folder}/03-Formate/hoku-organisch-${tone}.pdf`,Buffer.from(pdf.output('arraybuffer')));
 }
 const embed=(file,x,y,w,h=w)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${fs.readFileSync(path.join(root,file)).toString('base64')}"/>`;
 const text=(s,x,y,size=22)=>`<text x="${x}" y="${y}" font-family="Segoe UI" font-size="${size}" fill="#F5FBFF">${s}</text>`;
 let sheet='<rect width="1600" height="1030" fill="#070E13"/>'+text('HOKU / ORGANISCH · CYAN',48,62,34)+text('Zusätzlich bestätigt am 03.11.2026 · Originalmaster bleibt unverändert',48,104,21);
 sheet+=text('App-Icon · dunkler Hintergrund',48,163)+embed(`${folder}/01-App-Icons/hoku-app-organisch-cyan-512.png`,48,190,436);
 sheet+=text('Cyan · transparent',572,163)+embed(`${folder}/02-Symbole/hoku-organisch-cyan-transparent-512.png`,560,190,436);
 sheet+=text('Einfarbig · Weiß / Schwarz',1070,163)+embed(`${folder}/02-Symbole/hoku-organisch-weiss-transparent-512.png`,1050,190,220)+'<rect x="1300" y="190" width="240" height="436" rx="16" fill="#F3F5F7"/>'+embed(`${folder}/02-Symbole/hoku-organisch-schwarz-transparent-512.png`,1308,290,224);
 sheet+=text('Größenprobe · tatsächliche Pixelgrößen',48,700);
 for(const [i,size]of [16,24,32,48,64,96,128].entries())sheet+=embed(`${folder}/01-App-Icons/hoku-app-organisch-cyan-${size}.png`,48+i*206,740,size)+text(`${size} px`,48+i*206,914,18);
 sheet+=text('PNG · JPG · WebP · SVG mit eingebettetem Rastermotiv · PDF · ICO',48,992,23);
 const overview=write(`${folder}/HOKU-Organisch-Uebersicht.png`,rgbPng(render(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1030">${sheet}</svg>`)));
 const baseFile=path.join(__dirname,'hoku-uebersicht-vor-organisch.png');
 if(baseOverview)fs.writeFileSync(baseFile,baseOverview);else if(!fs.existsSync(baseFile))fs.copyFileSync(path.join(root,'HOKU-Uebersicht.png'),baseFile);
 const base=fs.readFileSync(baseFile),bh=base.readUInt32BE(20),extra=1288;
 write('HOKU-Uebersicht.png',rgbPng(render(`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="${bh+extra}"><rect width="2000" height="${bh+extra}" fill="#050C10"/><image width="2000" height="${bh}" href="data:image/png;base64,${base.toString('base64')}"/><image y="${bh}" width="2000" height="${extra}" href="data:image/png;base64,${overview.toString('base64')}"/></svg>`)));
 const note=`\n<!-- HOKU-ORGANISCH -->\n## Organisch / Cyan – zusätzliche bestätigte Fassung\n\nAm 03.11.2026 zusätzlich gewählt. **09-Organisch-Cyan** enthält den unveränderten Originalmaster, 25 App-Icon-PNG-Größen (16–1024 px), ein maskierbares 512-px-Icon, transparente Symbole in Cyan/Weiß/Schwarz, JPG, WebP, SVG, PDF sowie Favicons und ICO. App-Exporte nutzen einen zentrierten 84-%-Ausschnitt; der Originalmaster bleibt bytegleich. Freistellung als eigene Imagegen-Ableitung, nicht als veränderter App-Master.\n\nSVG und PDF betten das Rastermotiv ein; sie sind keine reine Vektorzeichnung. JPG und App-Icon-PNGs sind deckend; für Platzierung transparente PNG/SVG/WebP oder die entsprechenden PDFs nutzen. Cyan und Weiß auf dunklen Flächen, Schwarz auf hellen Flächen. Keine automatische Ersetzung der laufenden App, der bisherigen Logos oder des KI-/Nav-Symbols.\n\nErzeugen: node docs/logo/hoku/brand-kit-v2/QUELLEN/organisch.cjs. Prüfen: node docs/logo/hoku/brand-kit-v2/QUELLEN/verify.cjs. Übersicht: 09-Organisch-Cyan/HOKU-Organisch-Uebersicht.png.\n<!-- /HOKU-ORGANISCH -->\n`;
 const replaceBlock=(s,block)=>s.replace(/\n?<!-- HOKU-ORGANISCH -->[\s\S]*?<!-- \/HOKU-ORGANISCH -->\n?/g,'').trimEnd()+'\n'+block;
 for(const name of ['README.md','HOKU-Brand-Guide.md'])fs.writeFileSync(path.join(root,name),replaceBlock(fs.readFileSync(path.join(root,name),'utf8'),note));
 const gallery=`<!-- HOKU-ORGANISCH --><section><h2>Organisch / Cyan · zusätzliche Fassung</h2><p>Bestätigt am 03.11.2026. Ruhigere Partikel, organische Tiefe und natürliche Pupille. Die bisherigen Varianten bleiben erhalten.</p><img alt="Hoku Organisch Cyan – Formate und Größen" src="data:image/png;base64,${overview.toString('base64')}"><p><a href="${folder}/hoku-organisch-cyan-original.png" download>Originalmaster</a> · <a href="${folder}/01-App-Icons/hoku-app-organisch-cyan-1024.png" download>App-Icon 1024 px</a> · <a href="${folder}/02-Symbole/hoku-organisch-cyan-transparent-1024.png" download>Transparentes PNG</a> · <a href="${folder}/02-Symbole/hoku-organisch-cyan-transparent.svg" download>SVG</a> · <a href="${folder}/03-Formate/hoku-organisch-app.pdf" download>PDF</a> · <a href="${folder}/03-Formate/hoku-app-organisch-cyan.jpg" download>JPG</a> · <a href="${folder}/03-Formate/hoku-app-organisch-cyan.webp" download>WebP</a> · <a href="${folder}/04-Favicons/favicon.ico" download>ICO</a> · <a href="${folder}/README.md">Alle Varianten</a></p><p>SVG und PDF enthalten eingebettete Rasterbilder. Der Originalmaster bleibt unverändert. Diese Ergänzung installiert keine App-Änderung.</p></section><!-- /HOKU-ORGANISCH -->`;
 const htmlPath=path.join(root,'HOKU-Brand-Guide.html');
 let html=fs.readFileSync(htmlPath,'utf8').replace(/<!-- HOKU-ORGANISCH -->[\s\S]*?<!-- \/HOKU-ORGANISCH -->/g,'');
 html=html.replace('</main>',gallery+'</main>');fs.writeFileSync(htmlPath,html);
 write(`${folder}/README.md`,`# HOKU Organisch / Cyan\n\nZusätzlich bestätigt am 03.11.2026.\n\n- hoku-organisch-cyan-original.png: unveränderter ${opaqueSource.w} × ${opaqueSource.h}-px-Master.\n- 01-App-Icons: deckende RGB-PNGs in ${sizes.join(', ')} px; Maskable 512 px; SVG mit Rastermaster. Sichtbare Kugel ca. 84 % der Kante, Maskable 76 %.\n- 02-Symbole: transparentes Cyan, Weiß und Schwarz in 64/128/256/512/1024 px und SVG. Separate freigestellte Originalableitung enthalten.\n- 03-Formate: JPG, WebP, transparente WebP-Symbole und vier einseitige PDFs (App-Icon sowie Cyan/Weiß/Schwarz transparent).\n- 04-Favicons: PNGs in 16/24/32/48/64/128/256 px, SVG und ICO mit sieben Größen; engerer 92-%-Ausschnitt.\n\nCyan und Weiß sind für ruhige dunkle Flächen vorgesehen, Schwarz für helle Flächen. Dunkle App-Icons haben keine Transparenz oder vorgezeichneten runden Ecken; die Plattform maskiert sie. SVG und PDF enthalten hochauflösende Rasterbilder und sind keine reine Vektorgrafik. Die transparenten Fassungen sind Freistellungsableitungen; das freigegebene dunkle Motiv bleibt als unveränderter Originalmaster erhalten. Keine künstlich hochgerechneten 4K-Master, EPS- oder AI-Dateien.\n\nDie bisherigen Brand-Kit-Dateien bleiben verfügbar. Keine automatische Änderung der App oder des Nav-/KI-Symbols.\n`);
 fs.writeFileSync(path.join(root,'ORGANISCH-CHECKS.json'),JSON.stringify({approvedMasterSha256:hash(master),cutoutSha256:hash(cutout),sizes,ratios:{app:.84,maskable:.76,favicon:.92,symbol:.84},files},null,2));
 console.log(JSON.stringify({organicFiles:files.length,appSizes:sizes.length,pdfs:4,faviconEntries:7,approvedMasterExact:true}));
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1;});
