const fs=require('node:fs');
const path=require('node:path');
const solc=require('solc');

const root=path.resolve(__dirname,'..');
const contractsDir=path.join(root,'contracts');
const outDir=path.join(root,'build','contracts');
const names=['VerifiedMemberRegistry.sol','CivicGovernorV1.sol','CivicProjectVault.sol','CivicOutcomeAnchor.sol'];
const sources=Object.fromEntries(names.map(name=>[name,{content:fs.readFileSync(path.join(contractsDir,name),'utf8')}]));
function resolveImport(importPath){
  const candidates=[path.join(contractsDir,importPath),path.join(root,'node_modules',importPath)];
  const found=candidates.find(candidate=>fs.existsSync(candidate));
  return found?{contents:fs.readFileSync(found,'utf8')}:{error:`Import not found: ${importPath}`};
}
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},viaIR:true,outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:resolveImport}));
const errors=(output.errors||[]).filter(item=>item.severity==='error');
if(errors.length){for(const error of errors)console.error(error.formattedMessage);process.exit(1);}
fs.mkdirSync(outDir,{recursive:true});
for(const [sourceName,contracts] of Object.entries(output.contracts||{}))for(const [contractName,artifact] of Object.entries(contracts)){
  if(!names.includes(sourceName))continue;
  fs.writeFileSync(path.join(outDir,`${contractName}.json`),JSON.stringify({contractName,sourceName,abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,deployedBytecode:`0x${artifact.evm.deployedBytecode.object}`},null,2));
}
console.log(`Compiled ${names.length} production-direction contracts with solc ${solc.version()}.`);
