import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Copy,
  ExternalLink,
  Gamepad2,
  Image,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Wallet
} from "lucide-react";
import {
  addAllowlistWallets,
  clearAllowlist,
  clearInviteCodes,
  completeGame,
  generateInviteCodes,
  getGameStatus,
  getInviteAdminMessage,
  getInviteRedeemMessage,
  getLockedResults,
  getRegistrationMessage,
  listInviteCodes,
  listAllowlist,
  recordMint,
  readInviteSettings,
  removeAllowlistWallet,
  redeemInvite,
  registerWallet,
  startGame,
  updateInviteSettings
} from "./api/snakioxApi";
import {
  BOARD_SIZE,
  DIRECTIONS,
  START_SNAKE,
  getLevel,
  getSpeed,
  makeCellKey
} from "./game/snakeEngine";
import { useGame } from "./state/GameContext";
import {
  loadContractAdminSnapshot,
  loadMintSupplySnapshot,
  loadMintedToken,
  mintCompletedRun,
  setContractDefaultRoyalty,
  setContractGameSigner,
  setContractMintPrice,
  transferContractOwnership,
  withdrawContract
} from "./web3/mintContract";

const DIRECTION_KEYS = {
  ArrowUp: "UP",
  w: "UP",
  W: "UP",
  ArrowDown: "DOWN",
  s: "DOWN",
  S: "DOWN",
  ArrowLeft: "LEFT",
  a: "LEFT",
  A: "LEFT",
  ArrowRight: "RIGHT",
  d: "RIGHT",
  D: "RIGHT"
};

const CONTRACT_ADDRESS = import.meta.env.VITE_MINT_CONTRACT_ADDRESS || "";
const OPENSEA_BASE_URL =
  import.meta.env.VITE_OPENSEA_BASE_URL || "https://testnets.opensea.io/assets/sepolia";
const SEPOLIA_ETHERSCAN_BASE_URL = "https://sepolia.etherscan.io";

function buildOpenSeaAssetUrl(tokenId) {
  if (!CONTRACT_ADDRESS || !tokenId) return "";
  return `${OPENSEA_BASE_URL.replace(/\/$/, "")}/${CONTRACT_ADDRESS}/${tokenId}`;
}

function buildEtherscanTxUrl(txHash) {
  if (!txHash) return "";
  return `${SEPOLIA_ETHERSCAN_BASE_URL}/tx/${txHash}`;
}

function App() {
  const { state, dispatch } = useGame();
  const { game } = state;
  const [inviteCode, setInviteCode] = useState("");
  const [supply, setSupply] = useState(null);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const dialog = useDialog();
  const level = getLevel(game.score);
  const speed = getSpeed(game.score);
  const completedSessionRef = useRef(null);
  const isAdminPath = window.location.pathname === "/sekioadmini";

  useEffect(() => {
    const handleKeyDown = (event) => {
      const direction = DIRECTION_KEYS[event.key];
      if (!direction) return;
      event.preventDefault();
      dispatch({ type: "QUEUE_DIRECTION", direction });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    loadMintSupplySnapshot(state.wallet || "")
      .then((nextSupply) => {
        if (!cancelled) setSupply(nextSupply);
      })
      .catch(() => {
        if (!cancelled) setSupply(null);
      });

    return () => {
      cancelled = true;
    };
  }, [state.wallet]);

  useEffect(() => {
    if (game.phase !== "playing") return undefined;

    const timer = window.setInterval(() => {
      dispatch({ type: "STEP" });
    }, speed);

    return () => window.clearInterval(timer);
  }, [dispatch, game.phase, speed]);

  useEffect(() => {
    if (game.phase !== "dead" || !state.wallet || !game.sessionId) return;
    if (completedSessionRef.current === game.sessionId) return;

    completedSessionRef.current = game.sessionId;
    dispatch({ type: "SET_LOADING", label: "Locking run" });

    completeGame({
      sessionId: game.sessionId,
      wallet: state.wallet,
      score: game.score,
      snakeLength: game.snake.length,
      finalSnakeCells: game.snake,
      moves: game.moves,
      deathReason: game.deathReason
    })
      .then((result) => {
        dispatch({ type: "LOCKED", session: result.session, mint: result.mint });
      })
      .catch((error) => {
        dispatch({ type: "SET_ERROR", message: error.message });
      });
  }, [
    dispatch,
    game.deathReason,
    game.moves,
    game.phase,
    game.score,
    game.sessionId,
    game.snake,
    state.wallet
  ]);

  const handleWalletInput = (event) => {
    dispatch({ type: "SET_WALLET", wallet: event.target.value.trim() });
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      dispatch({ type: "SET_ERROR", message: "Install a browser wallet to register." });
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", label: "Connecting" });
      const [wallet] = await window.ethereum.request({ method: "eth_requestAccounts" });
      dispatch({ type: "SET_WALLET", wallet });
      await loadStatus(wallet);
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const register = async () => {
    if (!state.wallet) {
      dispatch({ type: "SET_ERROR", message: "Connect or enter a wallet first." });
      return;
    }

    if (!window.ethereum) {
      dispatch({ type: "SET_ERROR", message: "A browser wallet is required for signing." });
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", label: "Signing" });
      const { message } = await getRegistrationMessage(state.wallet);
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, state.wallet]
      });
      const registered = await registerWallet(state.wallet, signature);
      const status = await getGameStatus(state.wallet);
      dispatch({ type: "REGISTERED", user: registered.user, status });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const loadStatus = async (wallet = state.wallet) => {
    if (!wallet) return;
    try {
      dispatch({ type: "SET_LOADING", label: "Checking" });
      const [status, results] = await Promise.all([
        getGameStatus(wallet),
        getLockedResults(wallet).catch(() => ({ sessions: [] }))
      ]);
      dispatch({ type: "STATUS_LOADED", status });
      dispatch({ type: "RESULTS_LOADED", sessions: results.sessions || [] });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const play = async () => {
    if (!state.wallet) {
      dispatch({ type: "SET_ERROR", message: "Register a wallet before playing." });
      return;
    }

    try {
      completedSessionRef.current = null;
      dispatch({ type: "SET_LOADING", label: "Starting" });
      const session = await startGame(state.wallet);
      dispatch({ type: "STARTED", sessionId: session.sessionId });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const redeemCode = async () => {
    if (!state.wallet || !inviteCode) {
      dispatch({ type: "SET_ERROR", message: "Connect wallet and enter invite code first." });
      return;
    }

    if (!window.ethereum) {
      dispatch({ type: "SET_ERROR", message: "A browser wallet is required to redeem code." });
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", label: "Redeeming code" });
      const { message, code } = await getInviteRedeemMessage(state.wallet, inviteCode);
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, state.wallet]
      });
      await redeemInvite(state.wallet, code, signature);
      const status = await getGameStatus(state.wallet);
      dispatch({ type: "STATUS_LOADED", status });
      dialog.notify("Invite code redeemed. This wallet can now play and mint.");
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const fetchResult = async () => {
    if (!state.wallet) return;
    try {
      dispatch({ type: "SET_LOADING", label: "Loading result" });
      const result = await getLockedResults(state.wallet);
      dispatch({ type: "RESULTS_LOADED", sessions: result.sessions || [] });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.message });
    }
  };

  const mintRun = async () => {
    const mintPayload = state.mint || state.game.lockedResult;

    if (!mintPayload) {
      dispatch({ type: "SET_ERROR", message: "Complete or load a locked run before minting." });
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", label: "Minting" });
      const minted = await mintCompletedRun(mintPayload);
      const sessionId = mintPayload.sessionId || mintPayload.id;
      await recordMint(state.wallet || mintPayload.wallet, sessionId, minted.tokenId, minted.txHash);
      dispatch({ type: "MINTED", tokenId: minted.tokenId, txHash: minted.txHash });
      const [status, nextSupply] = await Promise.all([
        getGameStatus(state.wallet),
        loadMintSupplySnapshot(state.wallet)
      ]);
      dispatch({ type: "STATUS_LOADED", status });
      setSupply(nextSupply);
      dialog.notify(`Mint complete. Token #${minted.tokenId} is ready.`);
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: error.shortMessage || error.message });
    }
  };

  if (isAdminPath) {
    return (
      <>
        <AdminPage dialog={dialog} />
        <CustomDialog dialog={dialog} />
      </>
    );
  }

  return (
    <>
      <main className="app-shell h-screen max-h-screen overflow-hidden bg-[#142018] text-[#172611] font-arcade">
        <div className="app-layout mx-auto grid h-full max-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:grid-cols-[330px_minmax(0,1fr)_330px] lg:px-6">
          <ControlPanel
            state={state}
            onWalletInput={handleWalletInput}
            onConnect={connectWallet}
            onRegister={register}
            inviteCode={inviteCode}
            onInviteCodeChange={setInviteCode}
            onRedeemCode={redeemCode}
            onStatus={() => loadStatus()}
            onStart={play}
            onResult={fetchResult}
          />
          <MobileGameLauncher
            game={game}
            level={level}
            onOpen={() => setIsGameModalOpen(true)}
            speed={speed}
            supply={supply}
          />
          <section className="console-shell desktop-console flex min-h-0 flex-col">
            <div className="brand-strip">
              <span>SNAKIOX</span>
              <span>MODEL XERIA-09</span>
            </div>
            <GameSurface
              dispatch={dispatch}
              game={game}
              level={level}
              sessions={state.lockedResults}
              speed={speed}
              supply={supply}
            />
          </section>
          <ResultPanel state={state} level={level} speed={speed} onMint={mintRun} />
        </div>
      </main>
      {isGameModalOpen && (
        <MobileGameModal onClose={() => setIsGameModalOpen(false)}>
          <GameSurface
            canStart={Boolean(state.status?.canPlay || state.status?.activeSessionId)}
            dispatch={dispatch}
            game={game}
            isMobile
            level={level}
            onStart={play}
            sessions={state.lockedResults}
            speed={speed}
            supply={supply}
          />
        </MobileGameModal>
      )}
      <CustomDialog dialog={dialog} />
    </>
  );
}

function GameSurface({
  canStart = false,
  dispatch,
  game,
  isMobile = false,
  level,
  onStart,
  sessions,
  speed,
  supply
}) {
  return (
    <div className={["screen-bezel", "flex", "flex-1", "flex-col", isMobile ? "mobile-game-surface" : ""].join(" ")}>
      {isMobile ? null : <MintSupplyTracker supply={supply} />}
      <ScoreLine score={game.score} level={level} speed={speed} phase={game.phase} />
      <div className="mobile-play-layout">
        <SnakeBoard game={game} />
        {isMobile ? (
          <MobileDirectionPad
            canStart={canStart}
            dispatch={dispatch}
            gamePhase={game.phase}
            onStart={onStart}
          />
        ) : null}
      </div>
      {isMobile ? null : <TouchControls dispatch={dispatch} />}
      <ReplayPanel sessions={sessions} />
      <MintedTokensPanel sessions={sessions} />
    </div>
  );
}

function MobileGameLauncher({ game, level, onOpen, speed, supply }) {
  return (
    <section className="mobile-game-card">
      <div className="panel-title">
        <Gamepad2 size={18} />
        SNAKIOX GAME
      </div>
      <MintSupplyTracker supply={supply} />
      <div className="metric-row">
        <span>SCORE</span>
        <strong>{String(game.score).padStart(5, "0")}</strong>
      </div>
      <div className="metric-row">
        <span>LEVEL</span>
        <strong>{level}</strong>
      </div>
      <div className="metric-row">
        <span>SPEED</span>
        <strong>{speed}ms</strong>
      </div>
      <button className="start-button wide" onClick={onOpen} type="button">
        <Gamepad2 size={18} />
        OPEN GAME
      </button>
    </section>
  );
}

function MobileGameModal({ children, onClose }) {
  return (
    <div className="mobile-game-backdrop" role="presentation">
      <section className="mobile-game-modal" role="dialog">
        <div className="brand-strip">
          <span>SNAKIOX PLAYFIELD</span>
          <button className="modal-close" onClick={onClose} type="button">
            CLOSE
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MintSupplyTracker({ supply }) {
  const totalMinted = supply?.totalMinted ?? 0;
  const maxSupply = supply?.maxSupply ?? 6666;
  const percentage = maxSupply > 0 ? Math.min((totalMinted / maxSupply) * 100, 100) : 0;

  return (
    <section className="mint-tracker" aria-label="Mint progress">
      <div className="mint-tracker-top">
        <span>SNAKIOX SUPPLY</span>
        <strong>
          {totalMinted.toLocaleString()} / {maxSupply.toLocaleString()}
        </strong>
      </div>
      <div className="mint-track">
        <div className="mint-track-fill" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mint-tracker-bottom">
        <span>{percentage.toFixed(1)}% minted</span>
        <span>
          Wallet {supply?.mintedByWallet ?? 0}/{supply?.maxMintsPerWallet ?? 3}
        </span>
      </div>
    </section>
  );
}

function AdminPage({ dialog }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    adminWallet: "",
    allowlistInput: "",
    codeCount: "1000",
    inviteRequired: true,
    mintPriceEth: "",
    gameSigner: "",
    royaltyReceiver: "",
    royaltyBps: "500",
    withdrawRecipient: "",
    newOwner: ""
  });
  const [inviteCodes, setInviteCodes] = useState([]);
  const [allowlistEntries, setAllowlistEntries] = useState([]);

  const loadSnapshot = async () => {
    try {
      setLoadingLabel("Reading contract");
      setMessage("");
      const nextSnapshot = await loadContractAdminSnapshot();
      setSnapshot(nextSnapshot);
      setForm((current) => ({
        ...current,
        mintPriceEth: nextSnapshot.mintPriceEth,
        gameSigner: nextSnapshot.gameSigner,
        royaltyReceiver: nextSnapshot.owner,
        withdrawRecipient: nextSnapshot.owner,
        newOwner: nextSnapshot.owner
      }));
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const updateForm = (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value.trim();
    setForm({ ...form, [event.target.name]: value });
  };

  const connectAdminWallet = async () => {
    try {
      setLoadingLabel("Connecting wallet");
      const [wallet] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setForm((current) => ({ ...current, adminWallet: wallet }));
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const signAdminMessage = async () => {
    if (!form.adminWallet) throw new Error("Connect admin wallet first");
    const { message } = await getInviteAdminMessage(form.adminWallet);
    return window.ethereum.request({
      method: "personal_sign",
      params: [message, form.adminWallet]
    });
  };

  const generateCodes = async () => {
    try {
      setLoadingLabel("Generating codes");
      setMessage("");
      const signature = await signAdminMessage();
      const result = await generateInviteCodes(
        form.adminWallet,
        signature,
        Number(form.codeCount || 1)
      );
      setInviteCodes(result.codes);
      setMessage(`Generated ${result.codes.length} invite code(s)`);
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const loadCodes = async () => {
    try {
      setLoadingLabel("Loading codes");
      setMessage("");
      const signature = await signAdminMessage();
      const [codesResult, settingsResult] = await Promise.all([
        listInviteCodes(form.adminWallet, signature),
        readInviteSettings(form.adminWallet, signature)
      ]);
      const result = codesResult;
      setInviteCodes(result.codes);
      setForm((current) => ({
        ...current,
        inviteRequired: settingsResult.settings.inviteRequired
      }));
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const copyCode = async (code) => {
    await window.navigator.clipboard.writeText(code);
    dialog.notify(`Copied ${code}`);
  };

  const copyAllCodes = async () => {
    const codes = inviteCodes.map((invite) => invite.code).join("\n");
    if (!codes) {
      dialog.notify("No invite codes loaded.");
      return;
    }
    await window.navigator.clipboard.writeText(codes);
    dialog.notify(`Copied ${inviteCodes.length} invite code(s).`);
  };

  const clearCodes = async () => {
    const confirmed = await dialog.confirm("Clear every invite code from the backend?");
    if (!confirmed) return;

    try {
      setLoadingLabel("Clearing codes");
      setMessage("");
      const signature = await signAdminMessage();
      await clearInviteCodes(form.adminWallet, signature);
      setInviteCodes([]);
      setMessage("Invite codes cleared");
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const saveInviteRequirement = async () => {
    try {
      setLoadingLabel("Saving invite mode");
      setMessage("");
      const signature = await signAdminMessage();
      const result = await updateInviteSettings(
        form.adminWallet,
        signature,
        Boolean(form.inviteRequired)
      );
      setForm((current) => ({
        ...current,
        inviteRequired: result.settings.inviteRequired
      }));
      setMessage(result.settings.inviteRequired ? "Invite codes are required" : "Invite codes are off");
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const loadAllowlistEntries = async () => {
    try {
      setLoadingLabel("Loading allowlist");
      setMessage("");
      const signature = await signAdminMessage();
      const result = await listAllowlist(form.adminWallet, signature);
      setAllowlistEntries(result.entries || []);
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const addAllowlistEntries = async () => {
    const wallets = form.allowlistInput
      .split(/[\s,]+/)
      .map((wallet) => wallet.trim())
      .filter(Boolean);

    if (!wallets.length) {
      dialog.notify("Enter at least one wallet address.");
      return;
    }

    try {
      setLoadingLabel("Adding allowlist");
      setMessage("");
      const signature = await signAdminMessage();
      await addAllowlistWallets(form.adminWallet, signature, wallets);
      const result = await listAllowlist(form.adminWallet, signature);
      setAllowlistEntries(result.entries || []);
      setForm((current) => ({ ...current, allowlistInput: "" }));
      setMessage(`Added allowlist wallets. ${wallets.length} submitted.`);
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const removeAllowlistEntry = async (targetWallet) => {
    try {
      setLoadingLabel("Removing wallet");
      const signature = await signAdminMessage();
      await removeAllowlistWallet(form.adminWallet, signature, targetWallet);
      setAllowlistEntries((entries) =>
        entries.filter((entry) => entry.walletAddress !== targetWallet)
      );
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const clearAllowlistEntries = async () => {
    const confirmed = await dialog.confirm("Clear every wallet from the allowlist?");
    if (!confirmed) return;

    try {
      setLoadingLabel("Clearing allowlist");
      const signature = await signAdminMessage();
      await clearAllowlist(form.adminWallet, signature);
      setAllowlistEntries([]);
      setMessage("Allowlist cleared");
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  const copyAllowlist = async () => {
    if (!allowlistEntries.length) {
      dialog.notify("No allowlisted wallets loaded.");
      return;
    }

    await window.navigator.clipboard.writeText(
      allowlistEntries.map((entry) => entry.walletAddress).join("\n")
    );
    dialog.notify(`Copied ${allowlistEntries.length} allowlisted wallet(s).`);
  };

  const runAdminAction = async (label, action) => {
    try {
      setLoadingLabel(label);
      setMessage("");
      const receipt = await action();
      setMessage(`Confirmed ${receipt.hash}`);
      await loadSnapshot();
    } catch (error) {
      setMessage(error.shortMessage || error.message);
    } finally {
      setLoadingLabel("");
    }
  };

  return (
    <main className="min-h-screen bg-[#142018] px-4 py-5 font-arcade text-[#d7ff96]">
      <section className="mx-auto max-w-6xl console-shell">
        <div className="brand-strip">
          <span>SNAKIOX ADMIN</span>
          <span>HIDDEN ROUTE /SEKIOADMINI</span>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
          <aside className="panel">
            <div className="panel-title">
              <ShieldCheck size={18} />
              CONTRACT STATUS
            </div>
            <button className="start-button" onClick={loadSnapshot}>
              LOAD CONTRACT
            </button>
            <button className="press-key wide" onClick={connectAdminWallet}>
              CONNECT ADMIN WALLET
            </button>
            <input
              className="terminal-input"
              name="adminWallet"
              onChange={updateForm}
              placeholder="admin wallet"
              value={form.adminWallet}
            />
            {snapshot && (
              <>
                <div className="metric-row">
                  <span>CHAIN</span>
                  <strong>{snapshot.chainId}</strong>
                </div>
                <div className="metric-row">
                  <span>MINTED</span>
                  <strong>
                    {snapshot.totalMinted}/{snapshot.maxSupply}
                  </strong>
                </div>
                <div className="metric-row">
                  <span>PRICE</span>
                  <strong>{snapshot.mintPriceEth} ETH</strong>
                </div>
                <div className="metric-row">
                  <span>PER WALLET</span>
                  <strong>{snapshot.maxMintsPerWallet}</strong>
                </div>
                <div className="output-window">
                  <p>Contract</p>
                  <code>{snapshot.contractAddress}</code>
                  <p>Owner</p>
                  <code>{snapshot.owner}</code>
                  <p>Game signer</p>
                  <code>{snapshot.gameSigner}</code>
                </div>
              </>
            )}
            {loadingLabel && <div className="pulse-note">{loadingLabel}...</div>}
            {message && <div className="status-tape">{message}</div>}
          </aside>
          <section className="panel admin-grid">
            <div className="panel-title">
              <Wallet size={18} />
              OWNER ACTIONS
            </div>
            <AdminAction
              buttonLabel="SET MINT PRICE"
              inputName="mintPriceEth"
              label="Mint price in ETH"
              onChange={updateForm}
              onClick={() =>
                runAdminAction("Setting price", () => setContractMintPrice(form.mintPriceEth))
              }
              value={form.mintPriceEth}
            />
            <AdminAction
              buttonLabel="SET GAME SIGNER"
              inputName="gameSigner"
              label="Backend signer address"
              onChange={updateForm}
              onClick={() =>
                runAdminAction("Setting signer", () => setContractGameSigner(form.gameSigner))
              }
              value={form.gameSigner}
            />
            <div className="output-window">
              <div className="mini-title">DEFAULT ROYALTY</div>
              <input
                className="terminal-input"
                name="royaltyReceiver"
                onChange={updateForm}
                placeholder="receiver"
                value={form.royaltyReceiver}
              />
              <input
                className="terminal-input mt-2"
                name="royaltyBps"
                onChange={updateForm}
                placeholder="bps e.g. 500"
                value={form.royaltyBps}
              />
              <button
                className="press-key wide mt-2"
                onClick={() =>
                  runAdminAction("Setting royalty", () =>
                    setContractDefaultRoyalty(form.royaltyReceiver, form.royaltyBps)
                  )
                }
              >
                SET ROYALTY
              </button>
            </div>
            <AdminAction
              buttonLabel="WITHDRAW"
              inputName="withdrawRecipient"
              label="Withdraw recipient"
              onChange={updateForm}
              onClick={() =>
                runAdminAction("Withdrawing", () => withdrawContract(form.withdrawRecipient))
              }
              value={form.withdrawRecipient}
            />
            <AdminAction
              buttonLabel="TRANSFER OWNER"
              inputName="newOwner"
              label="New owner address"
              onChange={updateForm}
              onClick={() =>
                runAdminAction("Transferring owner", () =>
                  transferContractOwnership(form.newOwner)
                )
              }
              value={form.newOwner}
            />
            <div className="output-window invite-manager">
              <div className="mini-title">INVITE CODES</div>
              <label className="toggle-row">
                <input
                  checked={form.inviteRequired}
                  name="inviteRequired"
                  onChange={updateForm}
                  type="checkbox"
                />
                <span>Require invite code</span>
              </label>
              <button className="press-key wide" onClick={saveInviteRequirement}>
                SAVE INVITE MODE
              </button>
              <div className="invite-tools">
                <input
                  className="terminal-input"
                  name="codeCount"
                  onChange={updateForm}
                  placeholder="1000"
                  value={form.codeCount}
                />
                <button className="press-key" onClick={generateCodes}>
                  GENERATE
                </button>
                <button className="press-key" onClick={loadCodes}>
                  LOAD
                </button>
                <button className="press-key" onClick={copyAllCodes}>
                  COPY ALL
                </button>
                <button className="press-key" onClick={clearCodes}>
                  CLEAR
                </button>
              </div>
              <div className="invite-list compact">
                {inviteCodes.length === 0 && <div className="status-tape">No codes loaded.</div>}
                {inviteCodes.map((invite) => (
                  <div className="invite-row compact" key={invite.code}>
                    <code>{invite.code}</code>
                    <button
                      aria-label={`Copy ${invite.code}`}
                      className="icon-copy"
                      onClick={() => copyCode(invite.code)}
                      type="button"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="output-window allowlist-manager">
              <div className="mini-title">
                <ShieldCheck size={16} />
                ALLOWLIST ACCESS
              </div>
              <textarea
                className="terminal-input allowlist-input"
                name="allowlistInput"
                onChange={updateForm}
                placeholder={"0xWallet1\n0xWallet2\n0xWallet3"}
                value={form.allowlistInput}
              />
              <div className="allowlist-tools">
                <button className="press-key" onClick={addAllowlistEntries}>
                  ADD
                </button>
                <button className="press-key" onClick={loadAllowlistEntries}>
                  LOAD
                </button>
                <button className="press-key" onClick={copyAllowlist}>
                  COPY ALL
                </button>
                <button className="press-key" onClick={clearAllowlistEntries}>
                  CLEAR
                </button>
              </div>
              <div className="allowlist-list">
                {allowlistEntries.length === 0 && (
                  <div className="status-tape">No allowlisted wallets loaded.</div>
                )}
                {allowlistEntries.map((entry) => (
                  <div className="allowlist-row" key={entry.walletAddress}>
                    <code>{entry.walletAddress}</code>
                    <button
                      aria-label={`Copy ${entry.walletAddress}`}
                      className="icon-copy"
                      onClick={() => copyCode(entry.walletAddress)}
                      type="button"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      aria-label={`Remove ${entry.walletAddress}`}
                      className="icon-remove"
                      onClick={() => removeAllowlistEntry(entry.walletAddress)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminAction({ buttonLabel, inputName, label, onChange, onClick, value }) {
  return (
    <div className="output-window">
      <div className="mini-title">{label}</div>
      <input
        className="terminal-input"
        name={inputName}
        onChange={onChange}
        placeholder={label}
        value={value}
      />
      <button className="press-key wide mt-2" onClick={onClick}>
        {buttonLabel}
      </button>
    </div>
  );
}

function useDialog() {
  const [dialogState, setDialogState] = useState(null);
  const resolverRef = useRef(null);

  const close = (result = false) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialogState(null);
  };

  const notify = (message) => {
    setDialogState({
      message,
      mode: "notice",
      title: "SNAKIOX SIGNAL"
    });
  };

  const confirm = (message) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        message,
        mode: "confirm",
        title: "CONFIRM ACTION"
      });
    });

  return { close, confirm, notify, state: dialogState };
}

function CustomDialog({ dialog }) {
  if (!dialog.state) return null;

  const isConfirm = dialog.state.mode === "confirm";

  return (
    <div className="custom-alert-backdrop" role="presentation">
      <div className="custom-alert" role="dialog">
        <div className="brand-strip">
          <span>{dialog.state.title}</span>
          <span>{isConfirm ? "INPUT REQUIRED" : "READY"}</span>
        </div>
        <p>{dialog.state.message}</p>
        <div className="custom-alert-actions">
          {isConfirm && (
            <button className="press-key" onClick={() => dialog.close(false)} type="button">
              CANCEL
            </button>
          )}
          <button className="start-button" onClick={() => dialog.close(true)} type="button">
            {isConfirm ? "CONFIRM" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlPanel({
  state,
  onWalletInput,
  onConnect,
  onRegister,
  inviteCode,
  onInviteCodeChange,
  onRedeemCode,
  onStatus,
  onStart,
  onResult
}) {
  const canStart = state.status?.canPlay || state.status?.activeSessionId;

  return (
    <aside className="panel">
      <div className="panel-title">
        <Wallet size={18} />
        WALLET LINK
      </div>
      <input
        className="terminal-input"
        value={state.wallet}
        onChange={onWalletInput}
        placeholder="0x..."
        spellCheck="false"
      />
      <div className="grid grid-cols-2 gap-2">
        <button className="press-key" onClick={onConnect}>
          CONNECT
        </button>
        <button className="press-key" onClick={onRegister}>
          SIGN IN
        </button>
      </div>
      <button className="press-key wide" onClick={onStatus}>
        SCAN STATUS
      </button>
      <input
        className="terminal-input"
        onChange={(event) => onInviteCodeChange(event.target.value)}
        placeholder="SNX-INVITE-CODE"
        value={inviteCode}
      />
      <button className="press-key wide" onClick={onRedeemCode}>
        REDEEM CODE
      </button>
      <div className="status-tape">
        <p>{state.status?.registered ? "REGISTERED" : "UNREGISTERED"}</p>
        <p>
          {state.status?.isAllowlisted
            ? "ALLOWLIST ACCESS"
            : state.status?.hasInvite
              ? "CODE ACTIVE"
              : state.status?.inviteRequired === false
                ? "OPEN ACCESS"
                : "CODE REQUIRED"}
        </p>
        <p>{state.status?.reason || "ONE CODE. ONE NFT."}</p>
      </div>
      <button className="start-button" onClick={onStart} disabled={!canStart}>
        <Gamepad2 size={18} />
        START RUN
      </button>
      <button className="press-key wide" onClick={onResult}>
        LOAD LOCKED RESULT
      </button>
      {state.loadingLabel && <div className="pulse-note">{state.loadingLabel}...</div>}
      {state.error && <div className="error-tape">{state.error}</div>}
    </aside>
  );
}

function ScoreLine({ score, level, speed, phase }) {
  return (
    <div className="score-line">
      <span>SCORE {String(score).padStart(5, "0")}</span>
      <span>LV {level}</span>
      <span>{speed}MS</span>
      <span>{phase.toUpperCase()}</span>
    </div>
  );
}

function SnakeBoard({ game }) {
  const snakeCells = useMemo(() => new Set(game.snake.map(makeCellKey)), [game.snake]);
  const headKey = makeCellKey(game.snake[0]);

  return (
    <div className="lcd-wrap">
      <div
        className="snake-grid"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const key = `${x}:${y}`;
          const isFood = game.food.x === x && game.food.y === y;
          const isSnake = snakeCells.has(key);
          const isHead = key === headKey;
          return (
            <div
              className={[
                "grid-cell",
                isSnake ? "snake-cell" : "",
                isHead ? "snake-head" : "",
                isFood ? "food-cell" : ""
              ].join(" ")}
              key={key}
            />
          );
        })}
      </div>
      {game.phase === "idle" && <div className="screen-message">PRESS START</div>}
      {game.phase === "dead" && <div className="screen-message">SIGNAL LOST</div>}
      {game.phase === "locked" && <div className="screen-message">RESULT LOCKED</div>}
    </div>
  );
}

function TouchControls({ dispatch }) {
  const queue = (direction) => dispatch({ type: "QUEUE_DIRECTION", direction });

  return (
    <div className="touch-pad" aria-label="Direction controls">
      <button onClick={() => queue("UP")}>UP</button>
      <button onClick={() => queue("LEFT")}>LEFT</button>
      <button onClick={() => queue("DOWN")}>DOWN</button>
      <button onClick={() => queue("RIGHT")}>RIGHT</button>
    </div>
  );
}

function MobileDirectionPad({ canStart, dispatch, gamePhase, onStart }) {
  const queue = (direction) => dispatch({ type: "QUEUE_DIRECTION", direction });
  const isRunning = gamePhase === "running";

  return (
    <div className="mobile-control-deck">
      <div className="mobile-dpad" aria-label="Mobile direction controls">
        <button className="dpad-up" onClick={() => queue("UP")} type="button">
          <ChevronUp size={26} />
        </button>
        <button className="dpad-left" onClick={() => queue("LEFT")} type="button">
          <ChevronLeft size={26} />
        </button>
        <button className="dpad-right" onClick={() => queue("RIGHT")} type="button">
          <ChevronRight size={26} />
        </button>
        <button className="dpad-down" onClick={() => queue("DOWN")} type="button">
          <ChevronDown size={26} />
        </button>
      </div>
      <button
        aria-label="Start game"
        className="mobile-start-control"
        disabled={!canStart || isRunning}
        onClick={onStart}
        type="button"
      >
        <Gamepad2 size={20} />
        <span>{isRunning ? "LIVE" : "START"}</span>
      </button>
    </div>
  );
}

function ResultPanel({ state, level, speed, onMint }) {
  const session = state.game.lockedResult;
  const hasInviteAccess =
    state.status?.isAllowlisted ||
    state.status?.inviteRequired === false ||
    state.status?.hasInvite;
  const canMint = Boolean((state.mint || session) && !session?.txHash && hasInviteAccess);

  return (
    <aside className="panel">
      <div className="panel-title">
        <Trophy size={18} />
        RUN OUTPUT
      </div>
      <div className="metric-row">
        <span>LEVEL</span>
        <strong>{level}</strong>
      </div>
      <div className="metric-row">
        <span>SPEED</span>
        <strong>{speed}ms</strong>
      </div>
      <div className="metric-row">
        <span>LENGTH</span>
        <strong>{state.game.snake.length}</strong>
      </div>
      <div className="metric-row">
        <span>DEATH</span>
        <strong>{state.game.deathReason || session?.deathReason || "none"}</strong>
      </div>
      <button className="start-button" onClick={onMint} disabled={!canMint}>
        <ShieldCheck size={18} />
        MINT NFT
      </button>
      <div className="output-window">
        <div className="mini-title">
          <Activity size={16} />
          CONTROLS
        </div>
        <p>ARROWS / WASD / PAD</p>
        <p>Walls and self contact end the run.</p>
        <p>Every 50 points increases level and speed.</p>
      </div>
      <button className="press-key wide" onClick={() => window.location.reload()}>
        <RotateCcw size={16} />
        REBOOT DISPLAY
      </button>
      <div className="dead-mark">
        <CircleStop size={18} />
        CLASSIC MODE
      </div>
    </aside>
  );
}

function MintedTokensPanel({ sessions }) {
  const mintedSessions = sessions.filter((session) => session?.mintedTokenId);
  const [activeSession, setActiveSession] = useState(null);
  const tokenId = activeSession?.mintedTokenId;
  const [token, setToken] = useState(null);
  const [error, setError] = useState("");
  const openSeaUrl = buildOpenSeaAssetUrl(tokenId);
  const etherscanTxUrl = buildEtherscanTxUrl(activeSession?.txHash);

  useEffect(() => {
    if (!tokenId) {
      setToken(null);
      setError("");
      return undefined;
    }

    let cancelled = false;
    loadMintedToken(tokenId)
      .then((nextToken) => {
        if (!cancelled) setToken(nextToken);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.shortMessage || loadError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  if (!mintedSessions.length) return null;

  return (
    <section className="minted-strip">
      <div className="mini-title">
        <Image size={16} />
        MINTED NFT TOKENS
      </div>
      <div className="token-list">
        {mintedSessions.map((session, index) => (
          <button
            className="token-row"
            key={session.sessionId || session.id}
            onClick={() => setActiveSession(session)}
            type="button"
          >
            <span>#{session.mintedTokenId}</span>
            <strong>RUN {index + 1}</strong>
          </button>
        ))}
      </div>
      {activeSession && (
        <NftPreviewModal
          image={token?.image}
          onClose={() => setActiveSession(null)}
          openSeaUrl={openSeaUrl}
          tokenId={tokenId}
          txUrl={etherscanTxUrl}
        />
      )}
      {error && <small className="inline-error">{error}</small>}
    </section>
  );
}

function ReplayPanel({ sessions }) {
  const replaySessions = sessions.filter((session) => session?.moves?.length);
  const [activeSession, setActiveSession] = useState(null);

  if (!replaySessions.length) return null;

  return (
    <section className="replay-strip">
      <div className="mini-title">
        <Activity size={16} />
        RUN REPLAY
      </div>
      <div className="token-list">
        {replaySessions.map((session, index) => (
          <button
            className="token-row"
            key={session.sessionId || session.id}
            onClick={() => setActiveSession(session)}
            type="button"
          >
            <span>RUN {index + 1}</span>
            <strong>{session.score || 0} PTS</strong>
          </button>
        ))}
      </div>
      {activeSession && (
        <ReplayModal
          moves={activeSession.moves}
          onClose={() => setActiveSession(null)}
          session={activeSession}
        />
      )}
    </section>
  );
}

function ReplayModal({ moves, onClose, session }) {
  const frames = useMemo(() => buildReplayFrames(moves, session), [moves, session]);
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = frames[frameIndex] || frames[0] || START_SNAKE;
  const cells = new Set(frame.map(makeCellKey));
  const headKey = makeCellKey(frame[0] || START_SNAKE[0]);

  useEffect(() => {
    if (frames.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 85);

    return () => window.clearInterval(timer);
  }, [frames.length]);

  return (
    <div className="nft-modal-backdrop" onClick={onClose} role="presentation">
      <div className="replay-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="brand-strip">
          <span>SNAKIOX REPLAY</span>
          <button className="modal-close" onClick={onClose} type="button">
            CLOSE
          </button>
        </div>
        <div
          className="replay-grid"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
            const x = index % BOARD_SIZE;
            const y = Math.floor(index / BOARD_SIZE);
            const key = `${x}:${y}`;
            return (
              <div
                className={[
                  "grid-cell",
                  cells.has(key) ? "snake-cell" : "",
                  headKey === key ? "snake-head" : ""
                ].join(" ")}
                key={key}
              />
            );
          })}
        </div>
        <div className="metric-row">
          <span>FRAME</span>
          <strong>
            {frameIndex + 1}/{frames.length}
          </strong>
        </div>
      </div>
    </div>
  );
}

function buildReplayFrames(moves, session) {
  const sortedMoves = moves
    .filter((move) => DIRECTIONS[move.direction])
    .slice()
    .sort((a, b) => (a.tick || 0) - (b.tick || 0));
  const lastTick = Math.max(...sortedMoves.map((move) => move.tick || 0), 30);
  const targetLength = Math.max(session?.snakeLength || session?.finalSnakeCells?.length || 3, 3);
  let direction = sortedMoves[0]?.direction || "RIGHT";
  let moveIndex = 0;
  let snake = START_SNAKE.map((cell) => ({ ...cell }));
  const frames = [snake];

  for (let tick = 1; tick <= lastTick + 16; tick += 1) {
    while (sortedMoves[moveIndex + 1] && (sortedMoves[moveIndex + 1].tick || 0) <= tick) {
      moveIndex += 1;
      direction = sortedMoves[moveIndex].direction;
    }

    const delta = DIRECTIONS[direction];
    const head = snake[0];
    const nextHead = { x: head.x + delta.x, y: head.y + delta.y };

    if (
      nextHead.x < 0 ||
      nextHead.y < 0 ||
      nextHead.x >= BOARD_SIZE ||
      nextHead.y >= BOARD_SIZE
    ) {
      break;
    }

    const currentLength = Math.min(targetLength, 3 + Math.floor(tick / 10));
    snake = [nextHead, ...snake].slice(0, currentLength);
    frames.push(snake);
  }

  return frames;
}

function NftPreviewModal({ image, onClose, openSeaUrl, tokenId, txUrl }) {
  return (
    <div className="nft-modal-backdrop" onClick={onClose} role="presentation">
      <div className="nft-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="brand-strip">
          <span>Snakiox #{tokenId}</span>
          <button className="modal-close" onClick={onClose} type="button">
            CLOSE
          </button>
        </div>
        <div className="nft-modal-art">
          {image ? <img alt={`Snakiox #${tokenId}`} src={image} /> : <span>LOADING TOKEN</span>}
        </div>
        {openSeaUrl && (
          <a className="start-button" href={openSeaUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={18} />
            VIEW ON OPENSEA
          </a>
        )}
        {txUrl && (
          <a className="press-key wide" href={txUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            VIEW TX
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
