const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const opentype=require(path.resolve(__dirname,'../../../../../node_modules/three-stdlib/libs/opentype.cjs'));
const root=path.resolve(__dirname,'..'),checks=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function write(file,data){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
function font(file){const b=fs.readFileSync(path.join(root,'05-Schriften',file));return opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function typeset(font,s,size,tracking){
 const glyphs=font.stringToGlyphs(s),paths=[];let x=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 glyphs.forEach((g,i)=>{const p=g.getPath(x,0,size);if(p.commands.length){const b=p.getBoundingBox();minX=Math.min(minX,b.x1);maxX=Math.max(maxX,b.x2);minY=Math.min(minY,b.y1);maxY=Math.max(maxY,b.y2);paths.push(p.toPathData(4));}x+=g.advanceWidth/font.unitsPerEm*size;if(i<glyphs.length-1)x+=size*tracking+font.getKerningValue(g,glyphs[i+1])/font.unitsPerEm*size;});
 return {paths,minX,minY,width:maxX-minX,height:maxY-minY};
}
const michroma=font('Michroma-Regular.ttf'),plex=font('IBMPlexMono-Medium.ttf');
const heading=typeset(michroma,'HOKU',100,.16),sub=typeset(plex,'HEALTH HUB',100,.5);
const hs=410/heading.width,ss=410/sub.width,cap=heading.height*hs,fullHeight=cap+20+sub.height*ss;
const master=fs.readFileSync(path.join(__dirname,'hoku-app-icon-cyan-master.png'));
const source=fs.readFileSync(path.join(__dirname,'hoku-cyan-freigestellt-master.png'));
const sw=source.readUInt32BE(16),sh=source.readUInt32BE(20);
const defs=`<defs><image id="hoku" width="${sw}" height="${sh}" xlink:href="data:image/png;base64,${source.toString('base64')}"/>${['white','black'].map(t=>`<filter id="${t}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="gamma" amplitude="1" exponent="1.8" offset="0"/></feComponentTransfer><feColorMatrix type="matrix" values="0 0 0 0 ${t==='white'?1:0} 0 0 0 0 ${t==='white'?1:0} 0 0 0 0 ${t==='white'?1:0} 0 0 0 1 0"/></filter>`).join('')}</defs>`;
function svg(view,body,title='HOKU'){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${view[2]}" height="${view[3]}" viewBox="${view.join(' ')}"><title>${title}</title>${defs}${body}</svg>`;}
// Measure the visible particle body, excluding transparent padding.
const decoded=new Resvg(svg([0,0,sw,sh],'<use xlink:href="#hoku"/>')).render();
const sourcePixels=decoded.pixels;
let left=sw,right=0,top=sh,bottom=0,clear=0;
for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const a=sourcePixels[(y*sw+x)*4+3];if(a===0)clear++;if(a>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
if(clear<sw*sh*.2||right<=left)throw new Error('Source is not an isolated transparent mascot');
const box={left,right,top,bottom,width:right-left+1,height:bottom-top+1};
function mascot(cx,cy,height,tone='white'){
 const s=height/box.height,x=cx-(left+right+1)*s/2,y=cy-(top+bottom+1)*s/2;
 return `<use xlink:href="#hoku" transform="translate(${x} ${y}) scale(${s})"${tone==='cyan'?'':` filter="url(#${tone})"`}/>`;
}
function draw(t,x,y,s,ink){return `<g transform="translate(${x-t.minX*s} ${y-t.minY*s}) scale(${s})" fill="${ink}">${t.paths.map(d=>`<path d="${d}"/>`).join('')}</g>`;}
function text(s,x,y,w,ink){const t=typeset(plex,s,100,.35);return draw(t,x,y,w/t.width,ink);}
function full(ink,tone){const y=160-fullHeight/2;return mascot(173,160,fullHeight,tone)+draw(heading,287,y,hs,ink)+draw(sub,287,y+cap+20,ss,ink);}
const compactSymbolWidth=box.width*cap/box.height,compactLeft=compactSymbolWidth+32,compactWidth=compactLeft+410;
function compact(ink,tone){return mascot(compactSymbolWidth/2,cap/2,cap,tone)+draw(heading,compactLeft,0,hs,ink);}
function plaque(ink,tone){
 const t=typeset(plex,'TRACKED',100,.35),by=typeset(plex,'BY',100,.35),ch=t.height*111/t.width,ct=130-(2*ch+10)/2,s=440/594,ly=130-140*s/2;
 return `<rect x="70" y="38" width="760" height="184" rx="14" fill="none" stroke="${ink}" stroke-width="1.25"/>`+text('TRACKED',128,ct,111,ink)+text('BY',128,ct+ch+10,by.width*111/t.width,ink)+`<path d="M280 80V180" stroke="${ink}"/><g transform="translate(${324-103*s} ${ly-90*s}) scale(${s})">${full(ink,tone)}</g>`;
}
function render(file,content,width,expected={}){
 const r=new Resvg(content,{fitTo:{mode:'width',value:width},font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render();
 const pixels=r.pixels;
 let clear=0,visible=0,opaque=0,edge=0,colored=0;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const p=(y*r.width+x)*4,a=pixels[p+3];if(a===0)clear++;else{visible++;if(pixels[p]!==pixels[p+1]||pixels[p+1]!==pixels[p+2])colored++;}if(a===255)opaque++;if(a>=128&&(x===0||y===0||x===r.width-1||y===r.height-1))edge++;}
 if(expected.mono&&colored)throw new Error(file+': colored pixels in monochrome');
 if(expected.transparent&&(!clear||!visible||edge))throw new Error(file+': alpha or clipping');
 if(expected.opaque&&opaque!==r.width*r.height)throw new Error(file+': not opaque');
 const png=r.asPng();write(file,png);checks.push({file,width:r.width,height:r.height,clear,visible,opaque,colored,sha256:hash(png)});return png;
}
const assets=[
 {dir:'01-Hauptlogo',name:'hoku-health-hub',view:[63,50,674,220],draw:full},
 {dir:'02-Kompaktlogo',name:'hoku-kompakt',view:[-36,-36,compactWidth+72,cap+72],draw:compact},
 {dir:'03-Tracked-by-Plakette',name:'hoku-tracked-by-plakette',view:[36,4,828,252],draw:plaque}
];
for(const a of assets)for(const white of [true,false])for(const color of [false,true]){
 const ink=white?'#FFFFFF':'#000000',tone=color?'cyan':white?'white':'black',name=color?`cyan-schrift-${white?'weiss':'schwarz'}`:white?'weiss':'schwarz';
 const body=a.draw(ink,tone),stem=`${a.dir}/${a.name}-${name}`,transparent=svg(a.view,body);
 write(stem+'-transparent.svg',transparent);
 for(const width of [1200,2400])render(stem+`-transparent-${width}.png`,transparent,width,{mono:!color,transparent:true});
 const bg=white?'#000000':'#FFFFFF',solid=svg(a.view,`<rect x="${a.view[0]}" y="${a.view[1]}" width="${a.view[2]}" height="${a.view[3]}" fill="${bg}"/>`+body);
 write(stem+`-auf-${white?'schwarz':'weiss'}.svg`,solid);
 render(stem+`-auf-${white?'schwarz':'weiss'}-2400.png`,solid,2400,{mono:!color,opaque:true});
 if(!color&&a.name==='hoku-tracked-by-plakette'){const faint=svg(a.view,`<g opacity=".35">${body}</g>`);write(stem+'-dezent-35.svg',faint);render(stem+'-dezent-35-2400.png',faint,2400,{mono:true,transparent:true});}
}
for(const tone of ['cyan','white','black']){
 const label={cyan:'cyan',white:'weiss',black:'schwarz'}[tone],s=svg([0,0,1024,1024],mascot(512,512,800,tone));
 write(`04-Icons/hoku-symbol-${label}-transparent.svg`,s);
 for(const width of [512,1024])render(`04-Icons/hoku-symbol-${label}-transparent-${width}.png`,s,width,{mono:tone!=='cyan',transparent:true});
}
function icon(mono=false){return mono?svg([0,0,1024,1024],'<rect width="1024" height="1024" fill="#000000"/>'+mascot(512,512,760)):svg([0,0,1024,1024],`<image width="1024" height="1024" xlink:href="data:image/png;base64,${master.toString('base64')}"/>`);}
write('04-Icons/hoku-app-cyan-original.png',master);
for(const mono of [false,true])for(const size of [1024,512,192,180,96,64])render(`04-Icons/hoku-app-${mono?'monochrom':'cyan'}-${size}.png`,icon(mono),size,{mono,opaque:true});
// Tighter crop of the approved cyan master keeps the eye clearer at browser sizes.
const faviconSvg=svg([100,100,824,824],`<image width="1024" height="1024" xlink:href="data:image/png;base64,${master.toString('base64')}"/>`);
write('04-Icons/favicon.svg',faviconSvg);
const faviconPngs=[16,32,48,64].map(size=>({size,png:render(`04-Icons/hoku-favicon-${size}.png`,faviconSvg,size,{opaque:true})}));
const icoHead=Buffer.alloc(6+16*faviconPngs.length);icoHead.writeUInt16LE(1,2);icoHead.writeUInt16LE(4,4);let offset=icoHead.length;
faviconPngs.forEach(({size,png},i)=>{const p=6+i*16;icoHead[p]=size;icoHead[p+1]=size;icoHead.writeUInt16LE(1,p+4);icoHead.writeUInt16LE(32,p+6);icoHead.writeUInt32LE(png.length,p+8);icoHead.writeUInt32LE(offset,p+12);offset+=png.length;});
write('04-Icons/favicon.ico',Buffer.concat([icoHead,...faviconPngs.map(p=>p.png)]));
const label=(s,x,y,size=20,fill='#FFFFFF')=>`<text x="${x}" y="${y}" font-family="Segoe UI" font-size="${size}" fill="${fill}">${s}</text>`;
const present=(body,view,x,y,w,h,bg)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view.join(' ')}"><rect x="${view[0]}" y="${view[1]}" width="${view[2]}" height="${view[3]}" fill="${bg}"/>${body}</svg>`;
let sheet='<rect width="2000" height="1650" fill="#050C10"/>'+label('HOKU / BRAND KIT V2',48,64,34)+label('Cyan · natürliche Pupille · Michroma / IBM Plex Mono · 02.11.2026',48,108,20,'#A8CBD2');
for(const [i,a] of assets.entries()){
 const y=170+i*290;sheet+=label(['HAUPTLOGO / HEALTH HUB','KOMPAKT / OHNE UNTERZEILE','TRACKED BY / PLAKETTE 03'][i],48,y-14,17);
 sheet+=present(a.draw('#FFFFFF','cyan'),a.view,48,y,928,240,'#000000')+present(a.draw('#000000','black'),a.view,1024,y,928,240,'#FFFFFF');
}
sheet+=label('APP-ICON / FREIGEGEBENER MASTER',48,1085,18)+`<image x="48" y="1110" width="350" height="350" xlink:href="data:image/png;base64,${master.toString('base64')}"/>`;
sheet+=present(mascot(160,160,250,'white'),[0,0,320,320],465,1125,320,320,'#000000')+present(mascot(160,160,250,'black'),[0,0,320,320],850,1125,320,320,'#FFFFFF');
sheet+=label('KI-SYMBOL / UNVERÄNDERT',1270,1160,18)+`<image x="1270" y="1198" width="100" height="100" xlink:href="data:image/png;base64,${fs.readFileSync(path.join(root,'07-KI-Button-Symbol/hoku-ki-symbol-blau-128.png')).toString('base64')}"/>`+label('Funkeln integriert',1270,1350,20);
sheet+=label('Farbige und monochrome Logos · transparente PNGs · SVG-Layouts · Icons · Schriften · Brand-Guide',48,1560,23);
render('HOKU-Uebersicht.png',svg([0,0,2000,1650],sheet),2000,{opaque:true});
let proof='<rect width="1200" height="650" fill="#000000"/>'+label('HOKU / GRÖSSENPROBE IN ORIGINALPIXELN',32,45,24);
proof+=label('Hauptlogo · 240 px',32,92,17)+present(full('#FFFFFF','white'),assets[0].view,32,116,240,240*220/674,'#000000');
proof+=label('Kompaktlogo · 240 px',400,92,17)+present(compact('#FFFFFF','white'),assets[1].view,400,116,240,240*assets[1].view[3]/assets[1].view[2],'#000000');
proof+=label('Plakette · 440 px',32,277,17)+present(plaque('#FFFFFF','white'),assets[2].view,32,302,440,440*252/828,'#000000');
for(const [i,size]of [16,32,48,64].entries())proof+=label(`${size} px`,32+i*140,510,16)+`<image x="${32+i*140}" y="535" width="${size}" height="${size}" xlink:href="data:image/png;base64,${faviconPngs[i].png.toString('base64')}"/>`;
render('HOKU-Groessenprobe.png',svg([0,0,1200,650],proof),1200,{opaque:true});
const guide=`# HOKU – Brand-Guide v2

Stand: 02.11.2026. Aktuelle Branding-Auswahl.

## Hoku in Cyan mit natürlicher Pupille

Das ausdrücklich bestätigte Cyan-App-Icon ist der neue Bildmaster. Es zeigt Hoku als räumliche, lockere Partikelkugel mit natürlicher, leicht nach oben rechts versetzter Pupille. Die hellen Partikel am Pupillenrand sind nahezu weiß. Das 3H-Monogramm gehört nicht zu dieser gewählten Fassung.

Das App-Icon liegt als unverändertes Original und in gängigen Exportgrößen bei. Für Platzierungslogos wurde daraus per Bildbearbeitung eine freigestellte Fassung abgeleitet; sie ist ein eigener Rastermaster. Monochrome Fassungen nutzen dieselbe freigestellte Partikelstruktur mit neutraler Tönung und reduzierten weichen Halos.

## Gewählte Anordnungen

- Hauptlogo: Hoku links, HOKU und gleich breite Unterzeile HEALTH HUB rechts. Hoku entspricht optisch der gesamten Höhe der beiden Zeilen.
- Kompaktlogo: Hoku links und HOKU ohne Unterzeile, optisch gleich hoch.
- TRACKED BY: Plakette 03, TRACKED / BY links, Trennlinie, Hoku und zweizeiliger Name rechts. Rahmen und Abstände bleiben aus der bestätigten Fassung erhalten.
- KI-Button-Symbol: die vorhandene Kugel mit integriertem Funkeln bleibt ausdrücklich unverändert, einschließlich ihrer bisherigen Farben.

## Farben

Cyan **#00CCF5** ist der bestehende App-Akzent und die Referenz für die neue Bildwelt. Hokus Partikel variieren natürlich zwischen Türkis, Cyan und Eisweiß. Wortmarke, Unterzeile und Plakettenrahmen bleiben neutral **#FFFFFF** oder **#000000**. Die farbige Fassung bevorzugt ruhige dunkle Flächen, passend zum App-Icon mit tiefem Blau-Schwarz. Auf Weiß ist die monochrom schwarze Fassung die erste Wahl. Hokus Weißanteil und Transparenz nicht als zusätzlichen Hintergrund auffüllen.

## Schriften

HOKU: **Michroma Regular 400**, Sperrung +0,16 em. HEALTH HUB: **IBM Plex Mono Medium 500**, Sperrung +0,5 em und proportional auf dieselbe sichtbare Breite wie HOKU gesetzt. TRACKED BY: IBM Plex Mono Medium. Schriftdateien und OFL-Lizenzen liegen in 05-Schriften. Die Schrift ist in den SVGs als Pfad enthalten.

## Schutzraum und Größen

Mindestens eine halbe HOKU-Buchstabenhöhe außen freihalten. Exportflächen enthalten diesen Abstand bereits. Logo, Hoku, Schrift und Rahmen nur gemeinsam proportional skalieren. Die Größenprobe dient der Beurteilung im tatsächlichen Einsatz: Haupt- und Kompaktlogo möglichst ab **240 px Breite**, Plakette ab **440 px**. Hoku allein vorzugsweise ab **48 px**. Bei 16 px sind einzelne Partikel nicht mehr zuverlässig erkennbar; das Favicon ist ein technischer Rückfall. Im konkreten Einsatz bei 100 % prüfen. Im Druck einen Andruck nutzen.

## Dateien und Einsatz

- 01-Hauptlogo: Cyan mit neutraler Schrift sowie Schwarz und Weiß, mit und ohne Hintergrund.
- 02-Kompaktlogo: dieselben Fassungen ohne HEALTH HUB.
- 03-Tracked-by-Plakette: dieselben Fassungen, monochrom zusätzlich mit 35 % Deckkraft.
- 04-Icons: Cyan-App-Icon, monochromes Icon, transparente Einzelzeichen, Favicons und ICO.
- 05-Schriften: Originalschriften mit Lizenzen.
- 07-KI-Button-Symbol: unveränderte bisherige SVGs und PNGs.
- QUELLEN: bestätigtes Original, freigestellter Master und Erzeugungsskript.

Transparente PNGs sind freigestellt. Die feste Hintergrundfarbe steht im Dateinamen. Die SVGs enthalten Raster-Hoku mit Vektorschrift und Vektorrahmen: **kein vollständig vektorisierter Master**. Große Exporte erzeugen keine neuen Partikeldetails. Die Browser-Favicons verwenden einen engeren Ausschnitt des bestätigten Cyan-App-Icons, damit Hokus Auge in kleinen Größen klarer bleibt. Für App-Stores liegen quadratische 1024-px-PNGs vor; das Paket ist kein Android-Adaptive-Icon-Projekt. Diese Aktualisierung betrifft Branding-Dateien; die installierte oder veröffentlichte App wird damit nicht automatisch geändert.

## Geltung

Dieses Paket ersetzt Brand-Kit v1 für neue Anwendungen. Die alten Dateien bleiben als Verlauf in brand-kit-v1 erhalten. Die damaligen originalen Logo-Kompositionen sind historische Fassungen. Aktuell sind ausschließlich die Dateien aus diesem Paket und der bestätigte Cyan-Master. Keine weiteren Schatten, Konturen, Monogramme oder Zusatzzeichen hinzufügen.
`;
write('HOKU-Brand-Guide.md',guide);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const content=guide.trim().split('\n\n').map(p=>p.startsWith('# ')?`<h1>${esc(p.slice(2))}</h1>`:p.startsWith('## ')?`<h2>${esc(p.slice(3))}</h2>`:p.startsWith('- ')?`<ul>${p.split('\n').map(l=>`<li>${esc(l.slice(2))}</li>`).join('')}</ul>`:`<p>${esc(p)}</p>`).join('').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
const embed=file=>'data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
write('HOKU-Brand-Guide.html',`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HOKU Brand-Guide v2 · Cyan</title><style>body{margin:0;background:#050c10;color:#fff;font:17px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:48px auto;padding:0 28px 80px}h1{font-size:40px;line-height:1.2}h2{font-size:25px;margin-top:42px}p,li{max-width:940px}img{display:block;width:100%;height:auto;margin:28px 0;border:1px solid #24404a}a{color:#6ee6ff}strong{font-weight:650}.icon{max-width:380px}@media print{body{background:white;color:black}a{color:black}main{margin:0}img{break-inside:avoid}}</style><main><img alt="Aktuelles HOKU Brand-Kit v2" src="${embed('HOKU-Uebersicht.png')}">${content}<h2>Freigegebenes App-Icon</h2><a href="04-Icons/hoku-app-cyan-original.png" download>Unveränderten Originalmaster herunterladen</a> · <a href="04-Icons/hoku-app-cyan-1024.png" download>1024-px-App-Icon</a><img class="icon" alt="Hoku in Cyan mit natürlicher Pupille" src="${embed('04-Icons/hoku-app-cyan-original.png')}"><h2>Platzierungsdateien</h2><p><a href="01-Hauptlogo/hoku-health-hub-cyan-schrift-weiss-transparent-2400.png" download>Hauptlogo in Cyan</a> · <a href="02-Kompaktlogo/hoku-kompakt-cyan-schrift-weiss-transparent-2400.png" download>Kompaktlogo in Cyan</a> · <a href="03-Tracked-by-Plakette/hoku-tracked-by-plakette-weiss-transparent-2400.png" download>Plakette in Weiß</a> · <a href="04-Icons/hoku-symbol-cyan-transparent-1024.png" download>Hoku freigestellt</a></p><h2>Größenprobe</h2><p>Zur Beurteilung die PNG in Originalgröße öffnen.</p><img alt="HOKU Größenprobe" src="${embed('HOKU-Groessenprobe.png')}"><h2>KI-Symbol – unverändert</h2><img alt="Bestehendes KI-Symbol mit integriertem Funkeln" src="${embed('07-KI-Button-Symbol/HOKU-KI-Symbol-Uebersicht.png')}"></main></html>`);
write('README.md','# HOKU – Brand-Kit v2 / Cyan\n\nAktuelle Auswahl vom 02.11.2026. Start: HOKU-Uebersicht.png und HOKU-Brand-Guide.html.\n\nHoku mit natürlicher Pupille in Cyan ersetzt die alte pupillenlose Kugel. Schriften, gleich breite Unterzeile, Kompaktlogo und Plakette 03 bleiben erhalten. Das KI-Button-Symbol bleibt unverändert.\n\nOrdner und Größen sind im Guide beschrieben. Der bestätigte Bildmaster liegt unverändert unter 04-Icons/hoku-app-cyan-original.png. PNGs und SVG-Layouts enthalten Raster-Hoku; SVGs sind keine vollständig vektorisierten Master. Keine automatische Änderung der App oder Veröffentlichung.\n\nErzeugen: node docs/logo/hoku/brand-kit-v2/QUELLEN/build.cjs\nPrüfen: node docs/logo/hoku/brand-kit-v2/QUELLEN/verify.cjs\n');
const kiHashes=fs.readdirSync(path.join(root,'07-KI-Button-Symbol')).map(file=>({file:'07-KI-Button-Symbol/'+file,sha256:hash(fs.readFileSync(path.join(root,'07-KI-Button-Symbol',file)))}));
write('EXPORT-CHECKS.json',JSON.stringify({date:'2026-11-02',masterSha256:hash(master),sourceSha256:hash(source),sourceDimensions:{width:sw,height:sh},sourceVisibleBounds:box,equalWidths:{HOKU:410,HEALTH_HUB:sub.width*ss},compactEqualHeights:{HOKU:cap,Hoku:cap},fullEqualHeights:{text:fullHeight,Hoku:fullHeight},kiHashes,pngs:checks},null,2));
console.log(JSON.stringify({root,pngs:checks.length,sourceBounds:box,checks:'passed'}));
require('./vertikal.cjs')(fs.readFileSync(path.join(root,'HOKU-Uebersicht.png')));
require('./app-dunkel.cjs')(fs.readFileSync(path.join(root,'HOKU-Uebersicht.png')));
require('./organisch.cjs')(fs.readFileSync(path.join(root,'HOKU-Uebersicht.png'))).catch(e=>{console.error(e);process.exitCode=1;});
