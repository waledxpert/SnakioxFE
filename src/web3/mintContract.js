import {
  BrowserProvider,
  Contract,
  formatEther,
  getBytes,
  hexlify,
  id,
  keccak256,
  parseEther,
  toUtf8Bytes
} from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;
const FALLBACK_CONTRACT_ADDRESS = import.meta.env.VITE_MINT_CONTRACT_ADDRESS || "";
const FALLBACK_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || SEPOLIA_CHAIN_ID);

export const SNAKIOX_ABI = [
  "function mintWithGameResult(bytes snakeData, uint256 score, uint256 snakeLength, bytes32 sessionHash, bytes signature) payable returns (uint256 tokenId)",
  "function mintPrice() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MAX_MINTS_PER_WALLET() view returns (uint256)",
  "function gameSigner() view returns (address)",
  "function owner() view returns (address)",
  "function hasMinted(address wallet) view returns (bool)",
  "function mintedPerWallet(address wallet) view returns (uint256)",
  "function usedSession(bytes32 sessionHash) view returns (bool)",
  "function mintPayloadHash(address wallet, bytes32 sessionHash, bytes32 snakeDataHash, uint256 score, uint256 snakeLength) view returns (bytes32)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function svgForToken(uint256 tokenId) view returns (string)",
  "function setMintPrice(uint256 newMintPrice)",
  "function setGameSigner(address newGameSigner)",
  "function setDefaultRoyalty(address receiver, uint96 feeNumerator)",
  "function withdraw(address payable recipient)",
  "function transferOwnership(address newOwner)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

export async function mintCompletedRun(rawPayload) {
  if (!window.ethereum) {
    throw new Error("Install or unlock a browser wallet to mint.");
  }

  const payload = normalizeMintPayload(rawPayload);
  const provider = new BrowserProvider(window.ethereum);
  await ensureChain(Number(payload.chainId));

  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  if (signerAddress.toLowerCase() !== payload.wallet.toLowerCase()) {
    throw new Error("Connected wallet does not match the completed run wallet.");
  }

  const contract = new Contract(payload.contractAddress, SNAKIOX_ABI, signer);
  const mintPrice = await contract.mintPrice();
  const tx = await contract.mintWithGameResult(
    payload.snakeData,
    payload.score,
    payload.snakeLength,
    payload.sessionHash,
    payload.signature,
    { value: mintPrice }
  );
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    tokenId: extractTokenId(contract, receipt) || receipt.hash
  };
}

function normalizeMintPayload(payload) {
  const finalSnakeCells = payload.finalSnakeCells || [];
  const snakeData =
    payload.snakeData || hexlify(toUtf8Bytes(JSON.stringify(finalSnakeCells)));

  return {
    wallet: payload.wallet || payload.walletAddress,
    sessionId: payload.sessionId || payload.id,
    sessionHash: payload.sessionHash || id(payload.sessionId || payload.id),
    snakeData,
    snakeDataHash: payload.snakeDataHash || keccak256(getBytes(snakeData)),
    score: BigInt(payload.score || 0),
    snakeLength: BigInt(payload.snakeLength || finalSnakeCells.length || 0),
    contractAddress: payload.contractAddress || FALLBACK_CONTRACT_ADDRESS,
    chainId: payload.chainId || FALLBACK_CHAIN_ID,
    signature: payload.signature || payload.mintSignature
  };
}

export async function getSnakioxContractRead() {
  if (!window.ethereum) {
    throw new Error("Install or unlock a browser wallet.");
  }

  await ensureChain(FALLBACK_CHAIN_ID);
  const provider = new BrowserProvider(window.ethereum);
  return new Contract(FALLBACK_CONTRACT_ADDRESS, SNAKIOX_ABI, provider);
}

export async function getSnakioxContractWrite() {
  if (!window.ethereum) {
    throw new Error("Install or unlock a browser wallet.");
  }

  await ensureChain(FALLBACK_CHAIN_ID);
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(FALLBACK_CONTRACT_ADDRESS, SNAKIOX_ABI, signer);
}

export async function loadContractAdminSnapshot() {
  const contract = await getSnakioxContractRead();
  const [owner, gameSigner, mintPrice, totalMinted, maxSupply, maxMintsPerWallet] = await Promise.all([
    contract.owner(),
    contract.gameSigner(),
    contract.mintPrice(),
    contract.totalMinted(),
    contract.MAX_SUPPLY(),
    contract.MAX_MINTS_PER_WALLET()
  ]);

  return {
    owner,
    gameSigner,
    mintPriceWei: mintPrice.toString(),
    mintPriceEth: formatEther(mintPrice),
    totalMinted: totalMinted.toString(),
    maxSupply: maxSupply.toString(),
    maxMintsPerWallet: maxMintsPerWallet.toString(),
    contractAddress: FALLBACK_CONTRACT_ADDRESS,
    chainId: FALLBACK_CHAIN_ID
  };
}

export async function loadMintSupplySnapshot(wallet) {
  const contract = await getSnakioxContractRead();
  const calls = [contract.totalMinted(), contract.MAX_SUPPLY(), contract.MAX_MINTS_PER_WALLET()];
  if (wallet) calls.push(contract.mintedPerWallet(wallet));
  const [totalMinted, maxSupply, maxMintsPerWallet, mintedByWallet] = await Promise.all(calls);

  return {
    totalMinted: Number(totalMinted),
    maxSupply: Number(maxSupply),
    maxMintsPerWallet: Number(maxMintsPerWallet),
    mintedByWallet: mintedByWallet == null ? null : Number(mintedByWallet)
  };
}

export async function loadMintedToken(tokenId) {
  const contract = await getSnakioxContractRead();
  const [tokenURI, svg] = await Promise.all([
    contract.tokenURI(tokenId),
    contract.svgForToken(tokenId)
  ]);

  return {
    tokenId: String(tokenId),
    tokenURI,
    image: parseTokenImage(tokenURI) || svgToDataUri(svg),
    svg
  };
}

export async function setContractMintPrice(priceEth) {
  const contract = await getSnakioxContractWrite();
  const tx = await contract.setMintPrice(parseEther(priceEth));
  return tx.wait();
}

export async function setContractGameSigner(address) {
  const contract = await getSnakioxContractWrite();
  const tx = await contract.setGameSigner(address);
  return tx.wait();
}

export async function setContractDefaultRoyalty(receiver, feeNumerator) {
  const contract = await getSnakioxContractWrite();
  const tx = await contract.setDefaultRoyalty(receiver, BigInt(feeNumerator));
  return tx.wait();
}

export async function withdrawContract(recipient) {
  const contract = await getSnakioxContractWrite();
  const tx = await contract.withdraw(recipient);
  return tx.wait();
}

export async function transferContractOwnership(newOwner) {
  const contract = await getSnakioxContractWrite();
  const tx = await contract.transferOwnership(newOwner);
  return tx.wait();
}

async function ensureChain(chainId) {
  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }]
    });
  } catch (error) {
    if (error.code !== 4902 || chainId !== SEPOLIA_CHAIN_ID) throw error;

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"]
        }
      ]
    });
  }
}

function extractTokenId(contract, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "Transfer") return parsed.args.tokenId.toString();
    } catch {
      // Ignore logs from other contracts.
    }
  }

  return null;
}

function parseTokenImage(tokenURI) {
  const prefix = "data:application/json;base64,";
  if (!tokenURI?.startsWith(prefix)) return "";

  try {
    const metadata = JSON.parse(window.atob(tokenURI.slice(prefix.length)));
    return metadata.image || "";
  } catch {
    return "";
  }
}

function svgToDataUri(svg) {
  if (!svg) return "";
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
