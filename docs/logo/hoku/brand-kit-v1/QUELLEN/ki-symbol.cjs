const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),folder='07-KI-Button-Symbol';
const entries=[];
const variants=[{file:'hoku-ki-symbol-blau',label:'Hoku-Blau'},{file:'hoku-ki-symbol-weiss',label:'Weiß'}];
for(const v of variants){
 const svg=fs.readFileSync(path.join(root,folder,v.file+'.svg'),'utf8');
 if((svg.match(/<circle\b/g)||[]).length!==41||!svg.includes('translate(0.49 -0.49)'))throw new Error('Wrong selected integrated-star symbol');
 for(const size of [24,32,48,64,128,256]){
  const result=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render(),pixels=result.pixels;
  let clear=0,visible=0,edge=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=pixels[(y*size+x)*4+3];if(a)visible++;else clear++;if(a&&(x===0||y===0||x===size-1||y===size-1))edge++;}
  if(!clear||!visible||edge)throw new Error('Alpha or clipping issue');
  const png=result.asPng(),file=`${folder}/${v.file}-${size}.png`;
  fs.writeFileSync(path.join(root,file),png);entries.push({file,width:size,height:size,sha256:crypto.createHash('sha256').update(png).digest('hex')});
 }
}
const label=(s,x,y,size=18,color='#FFFFFF')=>`<text x="${x}" y="${y}" font-family="Segoe UI" font-size="${size}" fill="${color}">${s}</text>`;
let body='<rect width="1000" height="410" fill="#08090D"/>'+label('HOKU / FUNKELN INTEGRIERT',36,50,26)+label('Finales KI-Symbol · Freigestellt · SVG und PNG',36,84,16,'#A1A1A6');
for(const [i,v] of variants.entries()){
 const svg=fs.readFileSync(path.join(root,folder,v.file+'.svg'),'utf8');
 const content=svg.replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').replaceAll('hoku-color','hoku-paint-'+i).replaceAll('hoku-star','hoku-paint-'+i);
 body+=`<svg x="${92+i*480}" y="125" width="126" height="126" viewBox="-1.22 -1.22 2.44 2.44">${content}</svg>`+label(v.label,239+i*480,181,20);
 for(const [j,size]of [24,32,48].entries())body+=`<svg x="${89+i*480+j*116}" y="${310+(48-size)/2}" width="${size}" height="${size}" viewBox="-1.22 -1.22 2.44 2.44">${content.replaceAll('hoku-paint-'+i,'hoku-small-'+i+'-'+j)}</svg>`+label(size+' px',83+i*480+j*116,390,14,'#A1A1A6');
}
const preview=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="410">${body}</svg>`,{font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render().asPng();
fs.writeFileSync(path.join(root,folder,'HOKU-KI-Symbol-Uebersicht.png'),preview);
fs.writeFileSync(path.join(root,'KI-SYMBOL-CHECKS.json'),JSON.stringify(entries,null,2));
const section='## KI-Button-Symbol – gewählte Fassung C';
const note='\n'+section+'\n\nFinal gewählt: die vereinfachte Hoku-Partikelkugel mit integriertem vierzackigem Funkeln oben rechts. Der Stern sitzt in der Kugelkontur; umliegende Punkte lassen ihm freien Raum. Dateien in 07-KI-Button-Symbol: transparente, vollständig vektorbasierte SVGs in Hoku-Blau und Weiß sowie PNGs in 24, 32, 48, 64, 128 und 256 px. Standard: blaues Zeichen ab 24 px auf ruhigem dunklem Hintergrund. Weiß für passende dunkle oder farbige Flächen. Keine Schrift und keine Buttonfläche im Symbol.\n\nDas Zeichen steht für Hoku; die Aktion erklärt die Beschriftung des Buttons, z. B. „Essen erkennen“. Bei einem Button nur mit Symbol einen zugänglichen Namen wie „Essen mit Hoku erkennen“ setzen. Die anklickbare Fläche kann mindestens 44 × 44 px groß sein, während das Zeichen selbst 24–32 px bleibt.\n';
const mdFile=path.join(root,'HOKU-Brand-Guide.md');
fs.writeFileSync(mdFile,fs.readFileSync(mdFile,'utf8').split('\n'+section)[0].trimEnd()+'\n'+note);
const htmlFile=path.join(root,'HOKU-Brand-Guide.html');
let html=fs.readFileSync(htmlFile,'utf8').replace(/<!-- HOKU-KI-SYMBOL -->[\s\S]*?<!-- \/HOKU-KI-SYMBOL -->/,'');
const gallery='<!-- HOKU-KI-SYMBOL --><section><h2>KI-Button-Symbol · Funkeln integriert</h2><p>Finale Fassung mit vierzackigem Stern innerhalb der Kugelkontur. Nur das Symbol, ohne Buttonfläche oder Schrift. Transparente SVGs und PNGs in 24, 32, 48, 64, 128 und 256 px.</p><img alt="Hoku KI-Symbol mit integriertem Funkeln in Blau und Weiß" src="data:image/png;base64,'+preview.toString('base64')+'"><p><a href="'+folder+'/hoku-ki-symbol-blau.svg" download>SVG in Hoku-Blau</a> · <a href="'+folder+'/hoku-ki-symbol-weiss.svg" download>SVG in Weiß</a></p></section><!-- /HOKU-KI-SYMBOL -->';
html=html.includes('<!-- HOKU-APP-ICONS -->')?html.replace('<!-- HOKU-APP-ICONS -->',gallery+'<!-- HOKU-APP-ICONS -->'):html.replace('</main>',gallery+'</main>');
fs.writeFileSync(htmlFile,html);
const readmeFile=path.join(root,'README.md');let readme=fs.readFileSync(readmeFile,'utf8');readme=readme.replace(/^07-KI-Button-Symbol:.*$/m,'07-KI-Button-Symbol: finale Partikelkugel mit integriertem Funkeln, transparent in Blau und Weiß.');if(!readme.includes('07-KI-Button-Symbol:'))readme=readme.replace('QUELLEN:','07-KI-Button-Symbol: finale Partikelkugel mit integriertem Funkeln, transparent in Blau und Weiß.\nQUELLEN:');fs.writeFileSync(readmeFile,readme);
console.log(JSON.stringify({selected:'C – Funkeln integriert',particles:41,pngs:entries.length,transparent:true,noClipping:true}));
