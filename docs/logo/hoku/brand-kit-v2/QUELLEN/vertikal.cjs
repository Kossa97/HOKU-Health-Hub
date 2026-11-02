const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const opentype=require(path.resolve(__dirname,'../../../../../node_modules/three-stdlib/libs/opentype.cjs'));
const root=path.resolve(__dirname,'..'),folder='08-Vertikal-und-Plaketten';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function write(file,bytes){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
const masterSvg=fs.readFileSync(path.join(__dirname,'hoku-vertikal-v6-master.svg'),'utf8');
const masterPng=fs.readFileSync(path.join(__dirname,'hoku-vertikal-v6-master.png'));
const body=masterSvg.replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>[\s\S]*?<\/title>/,'').replace('<rect width="1360" height="1620" fill="#050C10"/>','');
if(body.includes('<rect width="1360"'))throw new Error('Master background not removed');
const fontBytes=fs.readFileSync(path.join(root,'05-Schriften/IBMPlexMono-Medium.ttf'));
const plex=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
let pen=0,minX=Infinity,maxX=-Infinity,minY=Infinity;const headerPaths=[];
const glyphs=plex.stringToGlyphs('TRACKED BY');
glyphs.forEach((g,i)=>{const p=g.getPath(pen,0,100);if(p.commands.length){const b=p.getBoundingBox();minX=Math.min(minX,b.x1);maxX=Math.max(maxX,b.x2);minY=Math.min(minY,b.y1);headerPaths.push(p.toPathData(4));}pen+=g.advanceWidth/plex.unitsPerEm*100;if(i<glyphs.length-1)pen+=35+plex.getKerningValue(g,glyphs[i+1])/plex.unitsPerEm*100;});
const headerScale=470/(maxX-minX);
const header=`<g fill="#FFFFFF" transform="translate(${445-minX*headerScale} ${148-minY*headerScale}) scale(${headerScale})">${headerPaths.map(d=>`<path d="${d}"/>`).join('')}</g><path d="M220 242H1140" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>`;
const forms=[
 {id:'hoku-vertikal-v6',label:'Vertikal · frei stehend',height:1620,content:body},
 {id:'hoku-vertikal-v6-tracked-by',label:'Plakette · TRACKED BY',height:1840,content:'<rect x="90" y="60" width="1180" height="1720" rx="24" fill="none" stroke="#FFFFFF" stroke-width="2"/>'+header+`<g transform="translate(0 145)">${body}</g>`},
 {id:'hoku-vertikal-v6-umrandung',label:'Plakette · nur Umrandung',height:1620,content:'<rect x="90" y="60" width="1180" height="1500" rx="24" fill="none" stroke="#FFFFFF" stroke-width="2"/>'+body}
];
function svg(height,content){return `<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="${height}" viewBox="0 0 1360 ${height}">${content}</svg>`;}
module.exports=function buildVertical(baseOverview){
 const checks=[];
 function render(file,source,width,{transparent=false,opaque=false}={}){
  const r=new Resvg(source,{fitTo:{mode:'width',value:width},font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render(),pixels=r.pixels;
  let clear=0,full=0,visible=0,edge=0;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const a=pixels[(y*r.width+x)*4+3];if(a===0)clear++;if(a===255)full++;if(a)visible++;if(a>=128&&(x===0||y===0||x===r.width-1||y===r.height-1))edge++;}
  if(transparent&&(!clear||!visible||edge))throw new Error(file+': transparency/clipping');
  if(opaque&&full!==r.width*r.height)throw new Error(file+': opaque background');
  const png=r.asPng();write(file,png);checks.push({file,width:r.width,height:r.height,clear,full,sha256:hash(png)});return png;
 }
 for(const [i,f]of forms.entries())for(const transparent of [false,true]){
  const stem=`${folder}/${f.id}-cyan${transparent?'-transparent':''}`;
  const content=(transparent?'':`<rect width="1360" height="${f.height}" fill="#050C10"/>`)+f.content;
  const vector=svg(f.height,content);write(stem+'.svg',i===0&&!transparent?masterSvg:vector);
  for(const width of [1360,2400]){
   const png=render(stem+`-${width}.png`,i===0&&!transparent?masterSvg:vector,width,{transparent,opaque:!transparent});
   if(i===0&&!transparent&&width===1360&&hash(png)!==hash(masterPng))throw new Error('Approved variant 6 has changed');
  }
 }
 const label=(s,x,y,size=24)=>`<text x="${x}" y="${y}" fill="#FFFFFF" font-family="Segoe UI" font-size="${size}">${s}</text>`;
 const image=(file,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${fs.readFileSync(path.join(root,file)).toString('base64')}"/>`;
 let overview='<rect width="2000" height="1110" fill="#050C10"/>'+label('HOKU / VERTIKAL · VARIANTE 6',48,58,32)+label('Frei stehend · TRACKED BY · nur Umrandung',48,100,19);
 for(const [i,f]of forms.entries())overview+=label(f.label,48+i*664,160,23)+image(`${folder}/${f.id}-cyan-1360.png`,48+i*664,195,576,576*f.height/1360);
 const overviewSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1110">${overview}</svg>`;
 const verticalSheet=render('HOKU-Vertikal-Uebersicht.png',overviewSvg,2000,{opaque:true});
 write('QUELLEN/hoku-uebersicht-basis.png',baseOverview);
 const baseHeight=baseOverview.readUInt32BE(20),combinedHeight=baseHeight+1110;
 const combined=`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="${combinedHeight}"><image width="2000" height="${baseHeight}" href="data:image/png;base64,${baseOverview.toString('base64')}"/><image y="${baseHeight}" width="2000" height="1110" href="data:image/png;base64,${verticalSheet.toString('base64')}"/></svg>`;
 render('HOKU-Uebersicht.png',combined,2000,{opaque:true});
 // Check the two actual visible text lines in the unchanged approved master.
 const pixels=new Resvg(masterSvg).render().pixels;
 function lineWidth(y0,y1){let min=1360,max=-1;for(let y=y0;y<y1;y++)for(let x=100;x<1260;x++){const p=(y*1360+x)*4;if(pixels[p]>180&&pixels[p+1]>180&&pixels[p+2]>180){min=Math.min(min,x);max=Math.max(max,x);}}return max-min+1;}
 const widths={HOKU:lineWidth(1160,1350),HEALTH_HUB:lineWidth(1370,1450)};
 if(Math.abs(widths.HOKU-widths.HEALTH_HUB)>2)throw new Error('Vertical subtitle widths differ');
 const section='## Vertikale Zusatzfassungen – Variante 6';
 const note=`\n${section}\n\nZusätzlich gewählt: Hoku groß über zwei gleich breiten Schriftzeilen. Die bestätigte Variante 6 kombiniert feinere HEALTH-HUB-Striche, optisch angepasste Buchstabenabstände und reduzierte Lichthöfe. HOKU nutzt hier eine engere Sperrung (+0,015 em vor den optischen Paaranpassungen); HEALTH HUB behält +0,5 em mit leicht reduziertem Wortabstand. Die feinere Strichstärke ist eine Vektor-Ableitung derselben IBM-Plex-Mono-Schrift. Diese Einstellungen gelten nur für diese vertikale Zusatzfassung.\n\nDateien in **08-Vertikal-und-Plaketten**: frei stehend, Plakette mit TRACKED BY und horizontaler Trennlinie sowie Plakette nur mit Umrandung. Alle drei in Cyan mit weißer Schrift, als PNG und SVG, mit tiefdunklem Hintergrund sowie transparent. PNG-Breiten: 1360 und 2400 px. Die frei stehende 1360-px-Fassung ist exakt die bestätigte Vorschau. Die Plaketten behalten die Größe und Anordnung des Motivs bei; die TRACKED-BY-Plakette ergänzt oben den Beschriftungsbereich. Rahmenradius und Strichstärke sind aufeinander abgestimmt.\n\nDie vorhandenen horizontalen Logos, die Plakette 03, das App-Icon und das KI-Button-Symbol bleiben erhalten. Bei transparenten Fassungen ruhige dunkle Flächen verwenden und die weißen Buchstaben, die feine Unterzeile und den Rahmen im tatsächlichen Einsatz prüfen.\n`;
 const mdFile=path.join(root,'HOKU-Brand-Guide.md');
 fs.writeFileSync(mdFile,fs.readFileSync(mdFile,'utf8').split('\n'+section)[0].trimEnd()+'\n'+note);
 const htmlFile=path.join(root,'HOKU-Brand-Guide.html');
 let html=fs.readFileSync(htmlFile,'utf8').replace(/<!-- HOKU-VERTIKAL-V6 -->[\s\S]*?<!-- \/HOKU-VERTIKAL-V6 -->/,'');
 const gallery='<!-- HOKU-VERTIKAL-V6 --><section><h2>Vertikal · Variante 6</h2><p>Die gewählte Kombination: feinere Unterzeile, präzisere Abstände und ruhigeres Leuchten. Zwei gleich breite Schriftzeilen. Drei Anordnungen, jeweils mit dunklem Hintergrund und transparent, PNG in 1360 und 2400 px sowie SVG.</p><img alt="Vertikale Hoku-Fassung und beide Plaketten" src="data:image/png;base64,'+verticalSheet.toString('base64')+'">'+forms.map(f=>`<h3>${f.label}</h3><p><a href="${folder}/${f.id}-cyan-1360.png" download>PNG · Originalgröße</a> · <a href="${folder}/${f.id}-cyan-2400.png" download>PNG · 2400 px</a> · <a href="${folder}/${f.id}-cyan-transparent-2400.png" download>PNG · transparent</a> · <a href="${folder}/${f.id}-cyan-transparent.svg" download>SVG · transparent</a></p>`).join('')+'<p>Die engeren Abstände und feineren Striche gelten für diese vertikale Zusatzfassung. Die übrigen Logo-Anordnungen bleiben erhalten.</p></section><!-- /HOKU-VERTIKAL-V6 -->';
 html=html.replace('</main>',gallery+'</main>').replace(/(alt="Aktuelles HOKU Brand-Kit v2" src=")data:image\/png;base64,[^"]+"/,'$1data:image/png;base64,'+fs.readFileSync(path.join(root,'HOKU-Uebersicht.png')).toString('base64')+'"');
 fs.writeFileSync(htmlFile,html);
 const readmeFile=path.join(root,'README.md');let readme=fs.readFileSync(readmeFile,'utf8');
 const readmeSection='## Vertikale Ergänzung';
 readme=readme.split('\n'+readmeSection)[0].trimEnd()+`\n\n${readmeSection}\n\n08-Vertikal-und-Plaketten enthält die bestätigte Variante 6 frei stehend, mit TRACKED BY und Trennlinie sowie nur mit Umrandung. Jeweils PNG/SVG, dunkel und transparent. Übersicht: HOKU-Vertikal-Uebersicht.png.\n`;
 fs.writeFileSync(readmeFile,readme);
 write('VERTIKAL-CHECKS.json',JSON.stringify({approvedMasterSha256:hash(masterPng),approvedSvgSha256:hash(Buffer.from(masterSvg)),equalWidths:widths,pngs:checks},null,2));
 console.log(JSON.stringify({verticalForms:3,pngs:checks.length,approvedVariant6Exact:true,equalWidths:widths}));
};
if(require.main===module)module.exports(fs.readFileSync(path.join(__dirname,'hoku-uebersicht-basis.png')));
