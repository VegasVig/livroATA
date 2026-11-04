require('./mocks.js');
const fs=require('fs'),vm=require('vm'),dir='../out/apps-script/';
const arqs=fs.readdirSync(dir).filter(f=>f.endsWith('.gs')).sort();
console.log('ordem:',arqs.join(' '));
for(const f of arqs){ try{ vm.runInThisContext(fs.readFileSync(dir+f,'utf8'),{filename:f}); }catch(e){ console.log('ERRO ao carregar '+f+': '+e.message); process.exit(1);} }
console.log('carregou ok');
