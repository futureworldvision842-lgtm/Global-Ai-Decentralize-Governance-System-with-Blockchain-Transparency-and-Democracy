const fs=require('node:fs');
const path=require('node:path');
const {ethers}=require('ethers');

const root=path.resolve(__dirname,'..');
const required=name=>{const value=process.env[name];if(!value)throw new Error(`${name} is required`);return value;};
const artifact=name=>JSON.parse(fs.readFileSync(path.join(root,'build','contracts',`${name}.json`),'utf8'));
async function deploy(wallet,name,args=[]){const item=artifact(name),factory=new ethers.ContractFactory(item.abi,item.bytecode,wallet),contract=await factory.deploy(...args);await contract.waitForDeployment();console.log(`${name}: ${await contract.getAddress()}`);return contract;}
async function main(){
  const provider=new ethers.JsonRpcProvider(required('ETHEREUM_RPC_URL'));
  const wallet=new ethers.Wallet(required('DEPLOYER_PRIVATE_KEY'),provider);
  const network=await provider.getNetwork();
  if(network.chainId===1n&&process.env.ALLOW_MAINNET_DEPLOY!=='true')throw new Error('Mainnet deployment is disabled. Use a testnet or explicitly set ALLOW_MAINNET_DEPLOY=true after audit.');
  const registry=await deploy(wallet,'VerifiedMemberRegistry',[wallet.address]);
  const founders=String(process.env.FOUNDING_WALLETS||wallet.address).split(',').map(x=>x.trim()).filter(ethers.isAddress);
  for(const founder of [...new Set(founders.map(x=>ethers.getAddress(x)))])await (await registry.grantMembership(founder)).wait();
  const governor=await deploy(wallet,'CivicGovernorV1',[await registry.getAddress(),Number(process.env.VOTING_DELAY_SECONDS||86400),Number(process.env.VOTING_PERIOD_SECONDS||432000),Number(process.env.EXECUTION_DELAY_SECONDS||172800),Number(process.env.QUORUM_BPS||3000),Number(process.env.APPROVAL_BPS||5001)]);
  const vault=await deploy(wallet,'CivicProjectVault',[await governor.getAddress(),process.env.PAUSE_GUARDIAN||wallet.address]);
  const anchor=await deploy(wallet,'CivicOutcomeAnchor',[await governor.getAddress()]);
  const registrarRole=await registry.REGISTRAR_ROLE(),adminRole=await registry.DEFAULT_ADMIN_ROLE();
  await (await registry.grantRole(registrarRole,await governor.getAddress())).wait();
  await (await registry.grantRole(adminRole,await governor.getAddress())).wait();
  await (await registry.renounceRole(registrarRole,wallet.address)).wait();
  await (await registry.renounceRole(adminRole,wallet.address)).wait();
  const deployment={chainId:network.chainId.toString(),network:network.name,deployedAt:new Date().toISOString(),registryAddress:await registry.getAddress(),governorAddress:await governor.getAddress(),projectVaultAddress:await vault.getAddress(),outcomeAnchorAddress:await anchor.getAddress()};
  const out=path.join(root,'build','deployment');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${network.chainId}.json`),JSON.stringify(deployment,null,2));
  console.log('Deployment complete. Verify all source code and run an external audit before public funds.');
}
main().catch(error=>{console.error(error.message);process.exit(1);});
