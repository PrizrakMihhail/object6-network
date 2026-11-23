import {readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
export async function catalog(directory){return (await readdir(directory,{withFileTypes:true})).filter(x=>x.isFile()&&/\.(png|jpe?g|webp|gif|avif)$/i.test(x.name)).map(x=>x.name).sort(new Intl.Collator('ru',{numeric:true,sensitivity:'base'}).compare).map((name,i)=>({src:'assets/microreader/'+encodeURIComponent(name),title:name.replace(/\.[^.]+$/,'').replace(/^clipping-(\d+)$/i,'ВЫРЕЗКА $1').replace(/[_-]+/g,' '),caption:`АРХИВНАЯ КОПИЯ // ЛИСТ ${String(i+1).padStart(2,'0')}`}))}
const slides=await catalog(new URL('assets/microreader/',dist));
await writeFile(new URL('microreader-catalog.js',dist),'window.MICROREADER_SLIDES='+JSON.stringify(slides,null,2)+';\n');
const page=new URL('index.html',dist),html=await readFile(page,'utf8'),total=String(slides.length).padStart(2,'0');
await writeFile(page,html.replace(/(id="microreaderButton"[^\n]*?<em>)\d+(<\/em>)/,'$1'+slides.length+'$2').replace(/(id="clippingCounter">)[^<]*/,'$1'+(slides.length?'01':'00')+' / '+total));
console.log(`Microreader: ${slides.length} images`);
