const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),folder='04-Icons/Dunkel';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const master=fs.readFileSync(path.join(__dirname,'hoku-app-icon-cyan-dunkel-master.png'));
const sizes=[1024,512,256,192,180,167,152,144,128,120,96,87,80,76,72,64,60,58,48,40,32,29,20,16];
function write(file,bytes){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(zlib.crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
function rgbPng(r){
 const rgba=r.pixels,rows=Buffer.alloc(r.height*(1+r.width*3));
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const p=(y*r.width+x)*4,q=y*(1+r.width*3)+1+x*3;if(rgba[p+3]!==255)throw new Error('Dark app export must be fully opaque');rows[q]=rgba[p];rows[q+1]=rgba[p+1];rows[q+2]=rgba[p+2];}
 const head=Buffer.alloc(13);head.writeUInt32BE(r.width,0);head.writeUInt32BE(r.height,4);head[8]=8;head[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function iconSvg(cropped=false){return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${cropped?'100 100 824 824':'0 0 1024 1024'}"><image width="1024" height="1024" href="data:image/png;base64,${master.toString('base64')}"/></svg>`;}
module.exports=function buildDark(baseOverview){
 const checks=[];
 function record(file,png){write(file,png);checks.push({file,width:png.readUInt32BE(16),height:png.readUInt32BE(20),colorType:png[25],sha256:hash(png)});return png;}
 record(`${folder}/hoku-app-cyan-dunkel-original.png`,master);
 for(const size of sizes){
  const r=new Resvg(iconSvg(),{fitTo:{mode:'width',value:size}}).render();
  const png=rgbPng(r);record(`${folder}/hoku-app-cyan-dunkel-${size}.png`,png);
  if(size===1024){
   const decoded=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><image width="1024" height="1024" href="data:image/png;base64,${png.toString('base64')}"/></svg>`).render().pixels;
   if(!Buffer.from(decoded).equals(Buffer.from(r.pixels)))throw new Error('RGB export changed pixels');
  }
 }
 const favicons=[16,32,48,64].map(size=>({size,png:record(`${folder}/hoku-favicon-dunkel-${size}.png`,rgbPng(new Resvg(iconSvg(true),{fitTo:{mode:'width',value:size}}).render()))}));
 write(`${folder}/favicon-dunkel.svg`,iconSvg(true));
 const icoHead=Buffer.alloc(6+16*favicons.length);icoHead.writeUInt16LE(1,2);icoHead.writeUInt16LE(favicons.length,4);let offset=icoHead.length;
 favicons.forEach(({size,png},i)=>{const p=6+i*16;icoHead[p]=size;icoHead[p+1]=size;icoHead.writeUInt16LE(1,p+4);icoHead.writeUInt16LE(32,p+6);icoHead.writeUInt32LE(png.length,p+8);icoHead.writeUInt32LE(offset,p+12);offset+=png.length;});
 const ico=Buffer.concat([icoHead,...favicons.map(f=>f.png)]);write(`${folder}/favicon.ico`,ico);
 write(`${folder}/README.md`,`# HOKU – dunkles Cyan-App-Icon\n\nZusätzliche dunkle Variante des aktuellen Hoku mit natürlicher Pupille und nahezu weißem Pupillenrand. Das hellere Cyan-Icon bleibt im übergeordneten Ordner erhalten.\n\n## Dateien\n\n- hoku-app-cyan-dunkel-original.png: unveränderter 1254-px-Master.\n- hoku-app-cyan-dunkel-{Größe}.png: ${sizes.join(', ')} px. Alle Exporte sind quadratische RGB-PNGs ohne Alphakanal.\n- hoku-favicon-dunkel-{Größe}.png: 16, 32, 48 und 64 px, mit engerem Ausschnitt für Browser-Tabs.\n- favicon.ico: dieselben vier Favicon-Größen.\n- favicon-dunkel.svg: eingebetteter Rastermaster, kein reiner Vektor.\n\n## Auswahl\n\n1024 px als großer App-Export; 512/192 px für Web-App-Verwendungen; 180/167/152/120 px und die weiteren Zwischenstufen für passende iPhone-/iPad-Bildflächen; 48/72/96/144/192 px für entsprechende Android-Bildflächen. Die Einbindung richtet sich nach dem jeweiligen Projekt. Das bestehende iOS-Projekt verwendet ein universelles 1024-px-Icon. Dieses Paket enthält Bilddateien, keine neu konfigurierte App oder Android-Adaptive-Icon-Ebenen. Die Fassungen behalten die sicheren Außenränder des bestätigten Motivs bei.\n`);
 const label=(s,x,y,size=24)=>`<text x="${x}" y="${y}" fill="#FFFFFF" font-family="Segoe UI" font-size="${size}">${s}</text>`;
 const image=(file,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${fs.readFileSync(path.join(root,file)).toString('base64')}"/>`;
 let sheet='<rect width="2000" height="1020" fill="#050C10"/>'+label('HOKU / APP-ICONS · CYAN UND DUNKEL',48,60,32)+label('Gleicher Hoku · zwei Lichtstimmungen · Originale und Größenexporte',48,104,20);
 sheet+=label('Cyan · bisherige Fassung',48,166,24)+image('04-Icons/hoku-app-cyan-1024.png',48,195,580,580);
 sheet+=label('Dunkel · zusätzliche Fassung',710,166,24)+image(`${folder}/hoku-app-cyan-dunkel-1024.png`,710,195,580,580);
 sheet+=label('Dunkel in tatsächlichen Größen',1370,166,23);
 for(const [i,size]of [48,96,180].entries()){const x=1370,y=220+i*190;sheet+=image(`${folder}/hoku-app-cyan-dunkel-${size}.png`,x,y,size,size)+label(size+' px',1580,y+32,19);}
 sheet+=label('RGB-PNG · 1024 bis 16 px · keine Transparenz im Größenexport · zusätzliche Favicons',48,886,23)+label('Der dunkle Originalmaster und die hellere Cyan-Variante bleiben separat erhalten.',48,935,20);
 const overviewSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1020">${sheet}</svg>`;
 const overview=record('HOKU-App-Icons-Uebersicht.png',rgbPng(new Resvg(overviewSvg,{font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render()));
 write('QUELLEN/hoku-uebersicht-mit-vertikal.png',baseOverview);
 const baseHeight=baseOverview.readUInt32BE(20),combinedHeight=baseHeight+1020;
 const combined=`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="${combinedHeight}"><image width="2000" height="${baseHeight}" href="data:image/png;base64,${baseOverview.toString('base64')}"/><image y="${baseHeight}" width="2000" height="1020" href="data:image/png;base64,${overview.toString('base64')}"/></svg>`;
 record('HOKU-Uebersicht.png',rgbPng(new Resvg(combined).render()));
 const section='## Dunkles App-Icon – zusätzliche Größen';
 const note=`\n${section}\n\nDie zusätzliche dunkle Variante zeigt den jetzigen Cyan-Hoku mit natürlicher Pupille, hellem Pupillenrand und zurückgenommenem Umgebungsleuchten. Sie liegt unter **04-Icons/Dunkel**, neben dem unveränderten helleren Cyan-Icon. Der dunkle Originalmaster bleibt unverändert enthalten.\n\nQuadratische RGB-PNGs ohne Alphakanal in **${sizes.join(', ')} px**. Zusätzliche Favicons in 16, 32, 48 und 64 px verwenden einen engeren Ausschnitt; favicon.ico enthält alle vier Größen. Original und 1024-px-Export werden gesondert auf Identität und Dateiformat geprüft. Die Übersicht HOKU-App-Icons-Uebersicht.png zeigt beide Stimmungen und kleinere tatsächliche Darstellungsgrößen. Diese Ergänzung ersetzt keine Bilddateien in der laufenden App.\n`;
 const mdFile=path.join(root,'HOKU-Brand-Guide.md');fs.writeFileSync(mdFile,fs.readFileSync(mdFile,'utf8').split('\n'+section)[0].trimEnd()+'\n'+note);
 const htmlFile=path.join(root,'HOKU-Brand-Guide.html');let html=fs.readFileSync(htmlFile,'utf8').replace(/<!-- HOKU-APP-DUNKEL -->[\s\S]*?<!-- \/HOKU-APP-DUNKEL -->/,'');
 const gallery='<!-- HOKU-APP-DUNKEL --><section><h2>App-Icon · zusätzliche dunkle Variante</h2><p>Das aktuelle Hoku-Motiv mit dunklerer Lichtstimmung. Die hellere Cyan-Variante bleibt erhalten. RGB-PNGs ohne Alphakanal von 1024 bis 16 px; zusätzliche Favicons.</p><img alt="Hoku App-Icons in Cyan und Dunkel, mit Größenvergleich" src="data:image/png;base64,'+overview.toString('base64')+'"><p><a href="'+folder+'/hoku-app-cyan-dunkel-original.png" download>Unveränderter Originalmaster</a> · <a href="'+folder+'/hoku-app-cyan-dunkel-1024.png" download>1024 px</a> · <a href="'+folder+'/hoku-app-cyan-dunkel-512.png" download>512 px</a> · <a href="'+folder+'/hoku-app-cyan-dunkel-192.png" download>192 px</a> · <a href="'+folder+'/hoku-app-cyan-dunkel-180.png" download>180 px</a> · <a href="'+folder+'/favicon.ico" download>Favicon ICO</a> · <a href="'+folder+'/README.md">Alle Größen und Verwendung</a></p></section><!-- /HOKU-APP-DUNKEL -->';
 html=html.replace('</main>',gallery+'</main>').replace(/(alt="Aktuelles HOKU Brand-Kit v2" src=")data:image\/png;base64,[^"]+"/,'$1data:image/png;base64,'+fs.readFileSync(path.join(root,'HOKU-Uebersicht.png')).toString('base64')+'"');fs.writeFileSync(htmlFile,html);
 const readmeFile=path.join(root,'README.md');let readme=fs.readFileSync(readmeFile,'utf8');const heading='## Dunkle App-Icon-Variante';readme=readme.split('\n'+heading)[0].trimEnd()+`\n\n${heading}\n\n04-Icons/Dunkel enthält den dunklen Originalmaster, ${sizes.length} RGB-PNG-Größen, Favicons und ICO. Die hellere Variante bleibt erhalten. Vergleich: HOKU-App-Icons-Uebersicht.png.\n`;fs.writeFileSync(readmeFile,readme);
 write('APP-DUNKEL-CHECKS.json',JSON.stringify({approvedMasterSha256:hash(master),sizes,icoSha256:hash(ico),pngs:checks},null,2));
 console.log(JSON.stringify({darkSizes:sizes.length,faviconSizes:4,originalPreserved:true,rgbWithoutAlpha:true,pngs:checks.length}));
};
if(require.main===module)module.exports(fs.readFileSync(path.join(__dirname,'hoku-uebersicht-mit-vertikal.png')));
