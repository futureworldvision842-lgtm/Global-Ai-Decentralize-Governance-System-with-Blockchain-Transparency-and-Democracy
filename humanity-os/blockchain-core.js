const CONFIG_KEY = "humanity-os-chain-config";

export function getChainConfig() {
  try { return { chainId: "0xaa36a7", anchorContract: "", governorContract: "", ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") }; }
  catch { return { chainId: "0xaa36a7", anchorContract: "", governorContract: "" }; }
}

export function setChainConfig(config) { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); return getChainConfig(); }

export async function connectWallet() {
  if (!globalThis.ethereum) throw new Error("No external wallet detected. Install a compatible wallet; Humanity OS never stores your private key.");
  const [address] = await ethereum.request({ method: "eth_requestAccounts" });
  const chainId = await ethereum.request({ method: "eth_chainId" });
  return { address, chainId, short: `${address.slice(0, 6)}…${address.slice(-4)}` };
}

export async function chainStatus() {
  const config = getChainConfig();
  if (!globalThis.ethereum) return { mode: "device-ledger", label: "Device ledger active · external wallet not connected", config };
  const chainId = await ethereum.request({ method: "eth_chainId" }).catch(() => null);
  return { mode: config.anchorContract ? "anchor-ready" : "wallet-available", label: config.anchorContract ? "Audit anchor configured" : "Wallet available · anchor contract not deployed", chainId, config };
}
