const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const folder='06-Originale';
fs.mkdirSync(path.join(root,folder),{recursive:true});
const originals=[
 {file:'hoku-health-hub-michroma-weiss-auf-schwarz-v1.png',label:'Weiß auf Schwarz'},
 {file:'hoku-health-hub-michroma-schwarz-auf-weiss-v1.png',label:'Schwarz auf Weiß'}
];
const manifest=[];
for(const item of originals){
 const bytes=fs.readFileSync(path.join(root,'../exports',item.file));
 fs.writeFileSync(path.join(root,folder,item.file),bytes);
 manifest.push({file:folder+'/'+item.file,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(root,'ORIGINAL-CHECKS.json'),JSON.stringify(manifest,null,2));
const mdPath=path.join(root,'HOKU-Brand-Guide.md');
const md=fs.readFileSync(mdPath,'utf8').split('\n## Originaldateien im bestätigten Format')[0];
fs.writeFileSync(mdPath,md+'\n## Originaldateien im bestätigten Format\n\nZusätzlich sind beide bestätigten Logo-PNGs unverändert mit ihrer ursprünglichen Bildfläche von 2700 × 1680 px enthalten:\n\n'+originals.map(o=>`- [${o.label}](${folder}/${o.file})`).join('\n')+'\n');
const htmlPath=path.join(root,'HOKU-Brand-Guide.html');
let html=fs.readFileSync(htmlPath,'utf8').replace(/<!-- HOKU-ORIGINALE -->[\s\S]*?<!-- \/HOKU-ORIGINALE -->/,'');
const gallery='<!-- HOKU-ORIGINALE --><section><h2>Unsere beiden Original-Logos</h2><p>Die bestätigten PNGs im unveränderten Originalformat, jeweils 2700 × 1680 px. Zusätzlich zu den enger zugeschnittenen Platzierungsdateien im Paket.</p>'+originals.map(o=>`<h3>${o.label}</h3><a href="${folder}/${o.file}" download="${o.file}">Original-PNG herunterladen</a><img alt="HOKU Health Hub – ${o.label}" src="data:image/png;base64,${fs.readFileSync(path.join(root,folder,o.file)).toString('base64')}">`).join('')+'</section><!-- /HOKU-ORIGINALE -->';
html=html.replace('</main>',gallery+'</main>');
html=html.replace(/<!-- HOKU-APP-ICONS -->[\s\S]*?<!-- \/HOKU-APP-ICONS -->/,'');
const appIcons=[{file:'hoku-app-blau-1024.png',label:'Blau'},{file:'hoku-app-farbig-1024.png',label:'Dunkel'}];
if(fs.existsSync(path.join(root,'04-Icons',appIcons[0].file))){
 const appGallery='<!-- HOKU-APP-ICONS --><section><h2>App-Logos: Blau und Dunkel</h2><div style="display:flex;flex-wrap:wrap;gap:24px">'+appIcons.map(o=>`<div style="flex:1 1 260px"><h3>${o.label}</h3><a href="04-Icons/${o.file}" download="${o.file}">PNG herunterladen</a><img alt="Hoku App-Logo ${o.label}" src="data:image/png;base64,${fs.readFileSync(path.join(root,'04-Icons',o.file)).toString('base64')}"></div>`).join('')+'</div></section><!-- /HOKU-APP-ICONS -->';
 html=html.replace('<!-- HOKU-ORIGINALE -->',appGallery+'<!-- HOKU-ORIGINALE -->');
}
fs.writeFileSync(htmlPath,html);
const readmePath=path.join(root,'README.md');
let readme=fs.readFileSync(readmePath,'utf8');
if(!readme.includes('06-Originale:'))readme=readme.replace('QUELLEN:', '06-Originale: die beiden bestätigten Logo-PNGs unverändert in 2700 × 1680 px.\nQUELLEN:');
readme=readme.replace('Alle Dateien sind neue Exporte. Die bisherigen Originaldateien bleiben erhalten.', 'Das Paket enthält neue Exporte und die beiden unveränderten Original-PNGs. Die bisherigen Originaldateien bleiben ebenfalls erhalten.');
fs.writeFileSync(readmePath,readme);
for(const item of manifest){const bytes=fs.readFileSync(path.join(root,item.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Copy mismatch');}
console.log(JSON.stringify({originals:manifest.map(({file,width,height})=>({file,width,height})),copiedWithoutChanges:true,guideUpdated:true}));
