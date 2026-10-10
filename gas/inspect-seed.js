var crypto = require('crypto');
var fs = require('fs');
var GAS = fs.readFileSync('gas/Code.gs', 'utf8');
var M = GAS.match(/ensureSeedPenggunaBaku_\([^)]*\)\s*\{[\s\S]*?\};/);
if (!M) { console.error('Tidak temu ensureSeedPenggunaBaku_'); process.exit(1); }
var hak = M[0].match(/hakAksesAwalSuperadmin\s*=\s*(\[[^\]]*\]);/);
if (!hak) { console.error('Tidak temu hakAksesAwalSuperadmin'); process.exit(1); }
console.log('Hak superadmin raw:');
console.log(hak[1]);
