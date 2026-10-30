const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const repo=path.resolve(root,'../../../..');
const {Resvg}=require(path.join(repo,'node_modules/@resvg/resvg-js'));
const opentype=require(path.join(repo,'node_modules/three-stdlib/libs/opentype.cjs'));
const fontDir=path.join(root,'05-Schriften');
const checks=[];
const files=[];
function write(name,data){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);files.push(name);}
function font(name){const b=fs.readFileSync(path.join(fontDir,name));return opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function typeset(font,s,size,tracking){
 const glyphs=font.stringToGlyphs(s),paths=[];let x=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 glyphs.forEach((g,i)=>{const p=g.getPath(x,0,size);if(p.commands.length){const b=p.getBoundingBox();minX=Math.min(minX,b.x1);maxX=Math.max(maxX,b.x2);minY=Math.min(minY,b.y1);maxY=Math.max(maxY,b.y2);paths.push(p.toPathData(4));}x+=g.advanceWidth/font.unitsPerEm*size;if(i<glyphs.length-1)x+=size*tracking+font.getKerningValue(g,glyphs[i+1])/font.unitsPerEm*size;});
 return {paths,minX,minY,width:maxX-minX,height:maxY-minY};
}
const michroma=font('Michroma-Regular.ttf'),plex=font('IBMPlexMono-Medium.ttf');
const heading=typeset(michroma,'HOKU',100,.16),sub=typeset(plex,'HEALTH HUB',100,.5);
const hs=410/heading.width,ss=410/sub.width,cap=heading.height*hs;
const sourcePng=fs.readFileSync(path.join(__dirname,'hoku-maskottchen-weiss-v1.png')).toString('base64');
const colorPng=fs.readFileSync(path.join(__dirname,'hoku-app-icon-dark-v1.png')).toString('base64');
const bluePng=fs.readFileSync(path.join(__dirname,'hoku-app-icon-premium-v1.png')).toString('base64');
const defs=`<defs><image id="hoku" width="1" height="1" xlink:href="data:image/png;base64,${sourcePng}"/><filter id="white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter><filter id="black" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter></defs>`;
function svg(view,body,title='HOKU'){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${view[2]}" height="${view[3]}" viewBox="${view.join(' ')}"><title>${title}</title>${defs}${body}</svg>`;}
function draw(t,x,y,s,ink){return `<g transform="translate(${x-t.minX*s} ${y-t.minY*s}) scale(${s})" fill="${ink}">${t.paths.map(d=>`<path d="${d}"/>`).join('')}</g>`;}
function text(s,x,y,w,ink){const t=typeset(plex,s,100,.35);return draw(t,x,y,w/t.width,ink);}
function mascot(cx,cy,d,ink){const frame=d/.67;return `<use xlink:href="#hoku" transform="translate(${cx-frame/2} ${cy-frame/2}) scale(${frame})" filter="url(#${ink==='#FFFFFF'?'white':'black'})"/>`;}
function full(ink){const top=160-(cap+20+sub.height*ss)/2;return mascot(173,160,140,ink)+draw(heading,287,top,hs,ink)+draw(sub,287,top+cap+20,ss,ink);}
// Measure the PNG at 50% alpha for equal optical height in the compact logo.
const sample=new Resvg(svg([0,0,1254,1254],`<use xlink:href="#hoku" transform="scale(1254)"/>`)).render();
const rgba=sample.pixels;let left=1254,right=0,top=1254,bottom=0;
for(let y=0;y<1254;y++)for(let x=0;x<1254;x++)if(rgba[(y*1254+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
const compactScale=cap/(bottom-top+1),symbolWidth=(right-left+1)*compactScale;
const compactLeft=symbolWidth+32,compactWidth=compactLeft+410;
function compact(ink){return `<use xlink:href="#hoku" transform="translate(${-left*compactScale} ${-top*compactScale}) scale(${1254*compactScale})" filter="url(#${ink==='#FFFFFF'?'white':'black'})"/>`+draw(heading,compactLeft,0,hs,ink);}
function plaque(ink){
 const t=typeset(plex,'TRACKED',100,.35),by=typeset(plex,'BY',100,.35),ch=t.height*111/t.width,ct=130-(2*ch+10)/2;
 const s=440/594,ly=130-140*s/2;
 return `<rect x="70" y="38" width="760" height="184" rx="14" fill="none" stroke="${ink}" stroke-width="1.25"/>`+text('TRACKED',128,ct,111,ink)+text('BY',128,ct+ch+10,by.width*111/t.width,ink)+`<path d="M280 80V180" stroke="${ink}" stroke-width="1"/><g transform="translate(${324-103*s} ${ly-90*s}) scale(${s})">${full(ink)}</g>`;
}
function render(name,source,width,expected={}){
 const r=new Resvg(source,{fitTo:{mode:'width',value:width},font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render();
 const px=r.pixels;let transparent=0,opaque=0,colored=0,visible=0,edge=0;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
  const p=(y*r.width+x)*4,a=px[p+3];if(a===0)transparent++;if(a===255)opaque++;if(a>0){visible++;if(px[p]!==px[p+1]||px[p+1]!==px[p+2])colored++;if((x===0||y===0||x===r.width-1||y===r.height-1)&&a>=128)edge++;}
 }
 if(expected.mono&&colored)throw new Error(`${name}: chromatic pixels`);
 if(expected.transparent&&(!transparent||!visible||edge))throw new Error(`${name}: alpha or clipping failure`);
 if(expected.opaque&&opaque!==r.width*r.height)throw new Error(`${name}: background not opaque`);
 const png=r.asPng();write(name,png);
 checks.push({file:name,width:r.width,height:r.height,transparentPixels:transparent,opaquePixels:opaque,coloredPixels:colored,visibleEdgePixels:edge,sha256:crypto.createHash('sha256').update(png).digest('hex')});
 return png;
}
const assets=[
 {dir:'01-Hauptlogo',name:'hoku-health-hub',view:[63,50,674,220],draw:full},
 {dir:'02-Kompaktlogo',name:'hoku-kompakt',view:[-36,-36,compactWidth+72,cap+72],draw:compact},
 {dir:'03-Tracked-by-Plakette',name:'hoku-tracked-by-plakette',view:[36,4,828,252],draw:plaque}
];
for(const a of assets)for(const white of [true,false]){
 const ink=white?'#FFFFFF':'#000000',tone=white?'weiss':'schwarz';
 const transparent=svg(a.view,a.draw(ink));
 const stem=`${a.dir}/${a.name}-${tone}-transparent`;
 write(stem+'.svg',transparent);
 render(stem+'-2400.png',transparent,2400,{mono:true,transparent:true});
 render(stem+'-1200.png',transparent,1200,{mono:true,transparent:true});
 const bg=white?'#000000':'#FFFFFF',background=`<rect x="${a.view[0]}" y="${a.view[1]}" width="${a.view[2]}" height="${a.view[3]}" fill="${bg}"/>`;
 const solid=svg(a.view,background+a.draw(ink));
 const solidStem=`${a.dir}/${a.name}-${white?'weiss-auf-schwarz':'schwarz-auf-weiss'}`;
 write(solidStem+'.svg',solid);render(solidStem+'-2400.png',solid,2400,{mono:true,opaque:true});
 if(a.name==='hoku-tracked-by-plakette'){
  const faint=svg(a.view,`<g opacity=".35">${a.draw(ink)}</g>`);
  write(`${a.dir}/${a.name}-${tone}-dezent-35.svg`,faint);
  render(`${a.dir}/${a.name}-${tone}-dezent-35-2400.png`,faint,2400,{mono:true,transparent:true});
 }
}
// Standalone symbols keep the existing PNG structure and its transparent spaces.
for(const white of [true,false]){
 const s=svg([0,0,1024,1024],mascot(512,512,800,white?'#FFFFFF':'#000000'));
 const stem=`04-Icons/hoku-symbol-${white?'weiss':'schwarz'}-transparent`;
 write(stem+'.svg',s);render(stem+'-1024.png',s,1024,{mono:true,transparent:true});
}
function icon(color){return color?svg([0,0,1024,1024],`<rect width="1024" height="1024" fill="#000000"/><image width="1024" height="1024" xlink:href="data:image/png;base64,${color==='blue'?bluePng:colorPng}"/>`):svg([0,0,1024,1024],`<rect width="1024" height="1024" fill="#000000"/>${mascot(512,512,800,'#FFFFFF')}`);}
write('04-Icons/hoku-app-blau-original-1254.png',Buffer.from(bluePng,'base64'));
for(const size of [1024,512,192,180])render(`04-Icons/hoku-app-blau-${size}.png`,icon('blue'),size,{opaque:true});
for(const color of [true,false])for(const size of [1024,512,192,180])render(`04-Icons/hoku-app-${color?'farbig':'monochrom'}-${size}.png`,icon(color),size,{mono:!color,opaque:true});
const faviconPngs=[];
for(const size of [16,32,48,64])faviconPngs.push({size,png:render(`04-Icons/hoku-favicon-${size}.png`,icon(false),size,{mono:true,opaque:true})});
const icoHead=Buffer.alloc(6+16*faviconPngs.length);icoHead.writeUInt16LE(1,2);icoHead.writeUInt16LE(faviconPngs.length,4);let offset=icoHead.length;
faviconPngs.forEach(({size,png},i)=>{const p=6+i*16;icoHead[p]=size;icoHead[p+1]=size;icoHead.writeUInt16LE(1,p+4);icoHead.writeUInt16LE(32,p+6);icoHead.writeUInt32LE(png.length,p+8);icoHead.writeUInt32LE(offset,p+12);offset+=png.length;});
write('04-Icons/favicon.ico',Buffer.concat([icoHead,...faviconPngs.map(p=>p.png)]));
// Presentation sheet: reusable assets are separate from these backgrounds.
const present=(body,view,x,y,w,h,bg)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view.join(' ')}"><rect x="${view[0]}" y="${view[1]}" width="${view[2]}" height="${view[3]}" fill="${bg}"/>${body}</svg>`;
const label=(s,x,y,size=20)=>`<text x="${x}" y="${y}" font-family="Segoe UI" font-size="${size}" fill="#FFFFFF">${s}</text>`;
let sheet=`<rect width="2000" height="1320" fill="#101010"/>${label('HOKU / BRAND KIT V1',48,62,32)}${label('Bestätigte Hauptfassung · kompakte Fassung ohne Unterzeile · Plakette 03',48,103,19)}`;
for(const [i,a] of assets.entries()){
 const y=171+i*292;sheet+=label(['HAUPTLOGO / HEALTH HUB','KOMPAKT / OHNE UNTERZEILE','TRACKED BY / PLAKETTE 03'][i],48,y-17,17);
 sheet+=present(a.draw('#FFFFFF'),a.view,48,y,928,240,'#000000')+present(a.draw('#000000'),a.view,1024,y,928,240,'#FFFFFF');
}
sheet+=label('HOKU / APP-ICON UND EINZELZEICHEN',48,1078,17);
sheet+=`<image x="48" y="1100" width="160" height="160" xlink:href="data:image/png;base64,${bluePng}"/><image x="248" y="1100" width="160" height="160" xlink:href="data:image/png;base64,${colorPng}"/>`;
sheet+=present(mascot(80,80,125,'#FFFFFF'),[0,0,160,160],448,1100,160,160,'#000000');
sheet+=present(mascot(80,80,125,'#000000'),[0,0,160,160],648,1100,160,160,'#FFFFFF');
sheet+=label('PNG + SVG · transparente Dateien · Schriften + Lizenzen · Guide',888,1172,21)+label('App-Icons: Blau und Dunkel. Schrift und Rahmen: rein Schwarz / Weiß.',888,1210,18);
const sheetSvg=svg([0,0,2000,1320],sheet,'HOKU Brand Kit Übersicht');
render('HOKU-Uebersicht.png',sheetSvg,2000);
// Proof at actual display sizes; no large preview is used to claim small-size legibility.
let proof='<rect width="1200" height="620" fill="#000000"/>'+label('HOKU / GRÖSSENPROBE IN ORIGINALPIXELN',32,44,24);
proof+=label('Mit HEALTH HUB · 240 px breit',32,86,17)+present(full('#FFFFFF'),assets[0].view,32,108,240,240*220/674,'#000000');
proof+=label('Ohne Unterzeile · 240 px breit',400,86,17)+present(compact('#FFFFFF'),assets[1].view,400,108,240,240*assets[1].view[3]/assets[1].view[2],'#000000');
proof+=label('Plakette · 440 px breit',32,270,17)+present(plaque('#FFFFFF'),assets[2].view,32,292,440,440*252/828,'#000000');
for(const [i,size] of [16,32,48,64].entries()){const png=fs.readFileSync(path.join(root,`04-Icons/hoku-favicon-${size}.png`)).toString('base64');proof+=label(`${size} px`,32+i*140,498,16)+`<image x="${32+i*140}" y="520" width="${size}" height="${size}" xlink:href="data:image/png;base64,${png}"/>`;}
render('HOKU-Groessenprobe.png',svg([0,0,1200,620],proof),1200,{mono:true,opaque:true});
const guide=`# HOKU – Brand-Guide v1\n\nStand: 29.10.2026.\n\n## Die gewählten Fassungen\n\n- **Hauptlogo:** Hoku links; HOKU und die gleich breite Unterzeile HEALTH HUB rechts. Die bestätigte Komposition bleibt erhalten.\n- **Kompaktlogo:** dieselbe Michroma-Wortmarke ohne HEALTH HUB. Maskottchen und Buchstaben sind optisch gleich hoch, vertikal bündig. Die Höhe der PNG-Silhouette wird bei 50 % Deckkraft gemessen.\n- **TRACKED BY:** bestätigte Plakette 03 mit gerundeten Ecken, vertikaler Trennlinie, Hoku und zweizeiligem Namen.\n- **Einzelzeichen:** das bestehende Hoku-PNG. Kein neues Punktmuster und kein Ersatz durch die ältere Vektorkugel.\n\n## Farben\n\nDie Logo- und Siegeldateien verwenden Schwarz **#000000** (RGB 0 / 0 / 0) und Weiß **#FFFFFF** (RGB 255 / 255 / 255). Weiche Partikelkanten und Transparenz erzeugen beim Anzeigen Zwischenwerte; das sind keine zusätzlichen Markenfarben. Das farbige App-Icon bleibt das vorhandene Blau–Violett-Motiv. Eine neue farbige Wortmarke oder verbindliche Akzentpalette wird mit diesem Paket nicht eingeführt.\n\n## Schriften\n\n**HOKU:** Michroma Regular 400, Sperrung +0,16 em. **HEALTH HUB:** IBM Plex Mono Medium 500, Sperrung +0,5 em, proportional auf dieselbe sichtbare Breite wie HOKU gesetzt. TRACKED BY nutzt IBM Plex Mono Medium. Beide Fonts und die OFL-Lizenzen liegen unter 05-Schriften. In den Logo-SVGs stehen die Buchstaben als Pfade; eine Fontinstallation ist für deren Anzeige nicht erforderlich.\n\n## Abstände und Größen\n\nAls Arbeitsregel außen mindestens eine halbe HOKU-Buchstabenhöhe freihalten; die Exportflächen enthalten bereits freien Rand. Bei der Plakette mindestens den vorhandenen Außenrand beibehalten. Die Abstände innerhalb der Dateien nicht verändern.\n\nAuf Grundlage der beiliegenden Größenprobe: Hauptlogo und Kompaktlogo möglichst ab **240 px Gesamtbreite**, Plakette ab **440 px**. Darunter Hoku allein verwenden, vorzugsweise ab **32 px**. Das 16-px-Favicon ist ein technischer Rückfall: seine einzelnen Partikel sind in dieser Größe nicht mehr getrennt lesbar. Bei Verkleinerung immer im tatsächlichen Einsatz prüfen. Für Druck hängt die Mindestgröße vom Verfahren und Material ab; ein Andruck ist nötig.\n\n## Welche Datei wofür?\n\n- **PNG transparent:** auf Bildern, Videos und eigenen Flächen platzieren. Weiß auf dunklen, Schwarz auf hellen, möglichst ruhigen Bildbereichen. 1200 px für normale Anwendungen, 2400 px für größere Layouts.\n- **PNG mit Hintergrund:** direkt verwendbare Präsentation auf Schwarz oder Weiß; nicht freigestellt.\n- **SVG:** Layout und Buchstaben bleiben scharf. Hoku ist bewusst das eingebettete PNG; die Datei ist daher **kein vollständig vektorisierter Master**. Für extreme Vergrößerungen den Rasteranteil prüfen.\n- **Dezent 35 %:** transparente Plakette zum unaufdringlichen Kennzeichnen. Für gute Lesbarkeit bevorzugt die normale Fassung verwenden.\n- **Icons:** quadratische PNGs, farbig aus dem vorhandenen dunklen App-Icon oder monochrom. 1024, 512, 192 und 180 px sowie Favicons in 16, 32, 48 und 64 px. Das ICO enthält alle vier Favicon-Größen.\n\n## Verwendung\n\nProportional skalieren. Hoku, Schrift und Rahmen gemeinsam skalieren; keine Einzelteile verzerren, umstellen oder unterschiedlich einfärben. Das Logo ohne zusätzliche Schatten, Konturen oder Verläufe verwenden. Die dezente Plakette sparsam einsetzen, nicht mehrfach über ein Bild verteilen. In App-Oberflächen übernimmt Hoku die Assistenz; das Branding muss nicht auf jeder Fläche als große Wortmarke erscheinen.\n\n## Umfang\n\nDieses Paket enthält die gewählten Logo- und Siegeldateien, die kompakte Fassung, Icons, Schriften und Regeln. Social-Media-Vorlagen, Bewegung und Store-Screenshots gehören nicht zu diesem Paket. Die Icon-PNGs werden nicht automatisch in die App eingebaut und bilden kein vollständiges plattformspezifisches Android-Adaptive-Icon-Projekt.\n`;
const finalGuide=guide.replace('Das farbige App-Icon bleibt das vorhandene Blau–Violett-Motiv.', 'Die vorhandenen App-Icons sind in zwei Fassungen enthalten: zuerst die hellere blaue Fassung (hoku-app-blau), danach die dunkle Fassung (hoku-app-farbig). Das blaue Original liegt zusätzlich unverändert als 1254-px-PNG bei.').replace('farbig aus dem vorhandenen dunklen App-Icon oder monochrom.', 'farbig aus dem blauen beziehungsweise dunklen App-Icon oder monochrom.');
write('HOKU-Brand-Guide.md',finalGuide);
const sheetData=fs.readFileSync(path.join(root,'HOKU-Uebersicht.png')).toString('base64');
const proofData=fs.readFileSync(path.join(root,'HOKU-Groessenprobe.png')).toString('base64');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const guideHtml=finalGuide.split('\n\n').map(p=>p.startsWith('# ')?`<h1>${escape(p.slice(2))}</h1>`:p.startsWith('## ')?`<h2>${escape(p.slice(3))}</h2>`:`<p>${escape(p).replaceAll('\n','<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</p>`).join('');
write('HOKU-Brand-Guide.html',`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HOKU Brand-Guide</title><style>body{margin:0;background:#101010;color:#fff;font:17px/1.65 system-ui,sans-serif}main{max-width:1050px;margin:48px auto;padding:0 28px 80px}h1{font-size:40px;line-height:1.2}h2{font-size:25px;margin-top:42px}p{max-width:900px}img{display:block;width:100%;height:auto;margin:32px 0;border:1px solid #444}strong{font-weight:650}@media print{body{background:white;color:black}main{margin:0}img{break-inside:avoid}h2{break-after:avoid}}</style><main><img alt="HOKU Logo-Übersicht" src="data:image/png;base64,${sheetData}">${guideHtml}<h2>Größenprobe</h2><p>Die eingebettete Vorschau kann im Browser skaliert sein. Für die Beurteilung die PNG in Originalgröße öffnen.</p><img alt="Logo-Größenprobe" src="data:image/png;base64,${proofData}"></main></html>`);
write('README.md','# HOKU – Branding-Paket v1\n\nStart: **HOKU-Uebersicht.png** ansehen und **HOKU-Brand-Guide.html** öffnen.\n\n01-Hauptlogo: mit HEALTH HUB.\n02-Kompaktlogo: ohne Unterzeile, Hoku und Schrift gleich hoch.\n03-Tracked-by-Plakette: gewählte Plakette 03.\n04-Icons: Einzelzeichen, quadratische App- und Browser-Icons.\n05-Schriften: Originalfonts und OFL-Lizenzen.\nQUELLEN: vorhandene Hoku-PNGs und Erzeugungsskript.\n\n`transparent` ist freigestellt; `weiss-auf-schwarz` und `schwarz-auf-weiss` enthalten einen festen Hintergrund. Die SVGs enthalten das Hoku-PNG, Buchstaben und Rahmen als Vektor.\n\nAlle Dateien sind neue Exporte. Die bisherigen Originaldateien bleiben erhalten.\n');
write('EXPORT-CHECKS.json',JSON.stringify({date:'2026-10-29',fonts:{headline:'Michroma 400',caption:'IBM Plex Mono 500'},equalWidths:{HOKU:410,HEALTH_HUB:sub.width*ss},compactEqualHeights:{HOKU:cap,Hoku:(bottom-top+1)*compactScale},pngs:checks},null,2));
console.log(JSON.stringify({root,pngCount:checks.length,generatedFiles:files.length,compactHeight:cap,compactMascotHeight:(bottom-top+1)*compactScale,checks:'passed'}));
require('./originale.cjs');
