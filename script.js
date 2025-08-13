// ====== Estado ======
const EPS = 1e-8;                  // ligeiramente maior para evitar falsos negativos
const SQRT2 = Math.sqrt(2);

let lambda = 0.75;
let round = 0;
let sumS = 0;
let sumQ = 0;
let xValues = [];
let autoPlaying = false;
let autoPlayInterval = null;
const AUTO_ROUNDS_LIMIT = 20;      // Limite de rodadas no modo automático

// ====== DOM ======
const lambdaInput = document.getElementById('lambdaInput');
const chips = [...document.querySelectorAll('.chip')];
const theoryBanner = document.getElementById('theoryBanner');
const startGameBtn = document.getElementById('startGameBtn');
const gameplayDiv = document.getElementById('gameplay');
const gameStatus = document.getElementById('gameStatus');
const playerTurn = document.getElementById('playerTurn');
const moveInput = document.getElementById('moveInput');
const makeMoveBtn = document.getElementById('makeMoveBtn');
const bestMoveBtn = document.getElementById('bestMoveBtn');
const roundNumberSpan = document.getElementById('roundNumber');
const sumSSpan = document.getElementById('sumS');
const sumQSpan = document.getElementById('sumQ');
const lastValidMoveSpan = document.getElementById('lastValidMove');
const historyList = document.getElementById('historyList');
const gameOverDiv = document.getElementById('gameOver');
const winnerMessage = document.getElementById('winnerMessage');
const restartGameBtn = document.getElementById('restartGameBtn');
const limitText = document.getElementById('limitText');
const warnText = document.getElementById('warnText');
const safeLambdaBtn = document.getElementById('safeLambdaBtn');
const aliceZeroBtn = document.getElementById('aliceZeroBtn');
const bazzaRoot2Btn = document.getElementById('bazzaRoot2Btn');
const autoPlayBtn = document.getElementById('autoPlayBtn');

// ====== Eventos ======
chips.forEach(b => b.addEventListener('click', () => setLambda(parseFloat(b.dataset.lambda))));
lambdaInput.addEventListener('input', () => setLambda(parseFloat(lambdaInput.value)));
startGameBtn.addEventListener('click', () => startGame(false));
makeMoveBtn.addEventListener('click', makeMove);
restartGameBtn.addEventListener('click', restartGame);
bestMoveBtn.addEventListener('click', playBestMove);
safeLambdaBtn.addEventListener('click', () => { if (!autoPlaying) setLambda(SQRT2 / 2); });
aliceZeroBtn.addEventListener('click', () => { if (!autoPlaying && isAliceTurn()) { moveInput.value = "0"; validateCurrentInput(); } });

// >>> atualizado: usa o teto legal do turno, um pouquinho abaixo, em vez de 1.414214 fixo
bazzaRoot2Btn.addEventListener('click', () => {
  if (!autoPlaying && !isAliceTurn()) {
    const { maxMove } = currentLimits();
    moveInput.value = String(bestLegalUnder(maxMove));
    validateCurrentInput();
  }
});

autoPlayBtn.addEventListener('click', toggleAutoPlay);
moveInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !makeMoveBtn.disabled && !autoPlaying) makeMove();
});
moveInput.addEventListener('input', validateCurrentInput);

// ====== Utilitários ======
function typeset() { if (window.MathJax) MathJax.typesetPromise(); }

function setLambda(val) {
  if (!isFinite(val) || val <= 0) return;
  lambda = val;
  lambdaInput.value = String(val);
  updateTheoryBanner();
  typeset();
}

function updateTheoryBanner() {
  const crit = SQRT2 / 2;
  let verdict;
  if (lambda < crit - EPS) verdict = "Com jogo perfeito: Bazza vence (\\(\\lambda < \\tfrac{\\sqrt{2}}{2}\\)).";
  else if (Math.abs(lambda - crit) <= EPS) verdict = "No limiar: empate possível (\\(\\lambda = \\tfrac{\\sqrt{2}}{2}\\)).";
  else verdict = "Com jogo perfeito: Alice vence (\\(\\lambda > \\tfrac{\\sqrt{2}}{2}\\)).";
  theoryBanner.innerHTML = `${verdict} &nbsp;•&nbsp; Valor atual: \\(\\lambda = ${lambda.toFixed(4)}\\)`;
  typeset();
}

function setControlsEnabled(enabled) {
  moveInput.disabled = !enabled;
  makeMoveBtn.disabled = !enabled;
  bestMoveBtn.disabled = !enabled;
  safeLambdaBtn.disabled = !enabled;
  aliceZeroBtn.disabled = !enabled;
  bazzaRoot2Btn.disabled = !enabled;
}

// novo: devolve um valor seguro logo abaixo do limite máximo permitido
function bestLegalUnder(max, pad = 1e-10) {
  if (!isFinite(max)) return 0;
  const v = Math.max(0, max - pad);        // um microdesconto para não estourar
  return Number(v.toPrecision(12));        // corta ruído de ponto flutuante
}

// ====== Fluxo do jogo ======
function startGame(autoMode) {
  const val = parseFloat(lambdaInput.value);
  if (!isFinite(val) || val <= 0) {
    alert("Informe um \\(\\lambda > 0\\).");
    return;
  }
  autoPlaying = !!autoMode;
  lambda = val;

  document.querySelector('.game-info').style.display = 'none';
  document.querySelector('.rules-summary').style.display = 'none';
  document.querySelector('.description').style.display = 'none';
  gameplayDiv.style.display = 'block';

  resetGame({ preserveAuto: true });
  nextRound();

  if (autoPlaying) {
    setLambda(SQRT2 / 2);                // força o caso de empate no limiar
    setControlsEnabled(false);
    autoPlayBtn.textContent = 'Parar Modo Auto';
    autoPlayInterval = setInterval(playAutoMove, 1500);
  } else {
    setControlsEnabled(true);
    autoPlayBtn.textContent = 'Modo Auto (Empate)';
    validateCurrentInput();
  }
}

function toggleAutoPlay() {
  if (gameplayDiv.style.display === 'none') { startGame(true); return; }
  if (autoPlaying) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    autoPlaying = false;
    setControlsEnabled(true);
    autoPlayBtn.textContent = 'Modo Auto (Empate)';
  } else {
    autoPlaying = true;
    setLambda(SQRT2 / 2);
    setControlsEnabled(false);
    autoPlayBtn.textContent = 'Parar Modo Auto';
    autoPlayInterval = setInterval(playAutoMove, 1500);
  }
}

// >>> atualizado: Bazza joga o MÁXIMO LEGAL do turno (um tiquinho abaixo do limite)
function playAutoMove() {
  if (round >= AUTO_ROUNDS_LIMIT) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    autoPlaying = false;
    endGame("Empate", "Estratégias seguras no limiar demonstram jogo indefinido.");
    return;
  }

  const { maxMove } = currentLimits();

  if (isAliceTurn()) {
    moveInput.value = "0";                 // no limiar, estratégia segura da Alice
  } else {
    moveInput.value = String(bestLegalUnder(maxMove)); // teto legal do Bazza
  }

  makeMove();
}

function resetGame({ preserveAuto = false } = {}) {
  round = 0; sumS = 0; sumQ = 0; xValues = [];
  gameOverDiv.style.display = 'none';
  updateStats();
  updateTheoryBanner();
  warnText.textContent = "";
  moveInput.value = "";
  makeMoveBtn.disabled = true;

  if (!preserveAuto) {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    autoPlaying = false;
    autoPlayBtn.textContent = 'Modo Auto (Empate)';
  }
}

function isAliceTurn() { return (round % 2) === 1; }

function nextRound() {
  round++;
  roundNumberSpan.textContent = round;

  const limits = currentLimits();
  moveInput.value = "";

  gameStatus.classList.remove('turn-alice', 'turn-bazza');
  if (isAliceTurn()) {
    gameStatus.textContent = "Rodada de Alice";
    gameStatus.classList.add('turn-alice');
    playerTurn.innerHTML = `Você é Alice. Escolha \\(x_${round} \\ge 0\\).`;
  } else {
    gameStatus.textContent = "Rodada de Bazza";
    gameStatus.classList.add('turn-bazza');
    playerTurn.innerHTML = `Você é Bazza. Escolha \\(x_${round} \\ge 0\\).`;
  }
  typeset();

  const maxStr = (limits.maxMove >= 0) ? limits.maxMove.toFixed(6) : "—";
  limitText.innerHTML = isAliceTurn()
    ? `Limite de Alice: \\(x_${round} \\le ${maxStr}\\) (pois \\(\\lambda n - S_{n-1}\\)).`
    : `Limite de Bazza: \\(x_${round} \\le ${maxStr}\\) (pois \\(\\sqrt{\\,n - Q_{n-1}\\,}\\)).`;

  if (!autoPlaying) {
    warnText.textContent = (Math.abs(limits.maxMove) <= EPS)
      ? "Atenção: neste turno só é permitido jogar 0."
      : "";
    validateCurrentInput();
  }
  typeset();

  if (limits.maxMove < -EPS) {
    const winner = isAliceTurn() ? "Bazza" : "Alice";
    endGame(winner, "Não há jogadas legais disponíveis para este turno.");
  }
}

function currentLimits() {
  if (round === 0) return { maxMove: Infinity };
  if (isAliceTurn()) {
    const max = lambda * round - sumS;
    return { maxMove: max };
  } else {
    const rem = round - sumQ;
    const max = rem < 0 ? -1 : Math.sqrt(Math.max(0, rem));
    return { maxMove: max };
  }
}

// >>> atualizado: usa bestLegalUnder no "melhor lance"
function playBestMove() {
  const { maxMove } = currentLimits();
  if (maxMove < -EPS) return;
  moveInput.value = String(bestLegalUnder(maxMove));
  validateCurrentInput();
}

function validateCurrentInput() {
  const val = parseFloat(moveInput.value);
  const { maxMove } = currentLimits();

  makeMoveBtn.disabled = true;
  warnText.textContent = "";

  if (!isFinite(val) || val < 0) return;
  if (maxMove < -EPS) return;

  if (val - maxMove > EPS) {
    warnText.textContent = "Valor excede o máximo permitido para este turno.";
    return;
  }

  if (Math.abs(maxMove) <= EPS && val !== 0) {
    warnText.textContent = "Atenção: só 0 é permitido agora.";
    return;
  }

  makeMoveBtn.disabled = false;
}

function makeMove() {
  const move = parseFloat(moveInput.value);
  const { maxMove } = currentLimits();

  if (!isFinite(move) || move < 0) {
    warnText.textContent = "A jogada deve ser um número não negativo.";
    return;
  }
  if (move - maxMove > EPS) {
    warnText.textContent = "Jogada inválida (excede o limite).";
    return;
  }

  const newSumS = sumS + move;
  const newSumQ = sumQ + move * move;

  if (isAliceTurn()) {
    if (newSumS - lambda * round > EPS) {
      endGame("Bazza", "Alice excedeu o limite de soma.");
      return;
    }
  } else {
    if (newSumQ - round > EPS) {
      endGame("Alice", "Bazza excedeu o limite quadrático.");
      return;
    }
  }

  sumS = newSumS;
  sumQ = newSumQ;
  xValues.push(move);
  updateStats();
  nextRound();
}

function updateStats() {
  sumSSpan.textContent = sumS.toFixed(6);
  sumQSpan.textContent = sumQ.toFixed(6);
  lastValidMoveSpan.textContent = xValues.length ? xValues[xValues.length - 1].toFixed(6) : "—";
  historyList.textContent = xValues.length ? xValues.map(v => v.toFixed(3)).join(", ") : "—";
}

function endGame(winner, reason = "") {
  if (winner === "Empate") {
    winnerMessage.textContent = `Empate demonstrado! ${reason ? `(${reason})` : ""}`;
  } else {
    winnerMessage.textContent = `${winner} venceu o jogo!${reason ? ` (${reason})` : ""}`;
  }
  gameplayDiv.style.display = 'none';
  gameOverDiv.style.display = 'block';
  document.querySelector('.game-info').style.display = 'block';
  document.querySelector('.rules-summary').style.display = 'block';
  document.querySelector('.description').style.display = 'block';
  startGameBtn.textContent = 'Novo Jogo';

  if (autoPlayInterval) clearInterval(autoPlayInterval);
  autoPlayInterval = null;
  autoPlaying = false;
  setControlsEnabled(true);
  autoPlayBtn.textContent = 'Modo Auto (Empate)';
}

function restartGame() {
  document.querySelector('.game-info').style.display = 'block';
  document.querySelector('.rules-summary').style.display = 'block';
  document.querySelector('.description').style.display = 'block';
  gameOverDiv.style.display = 'none';
  gameplayDiv.style.display = 'none';
  startGameBtn.textContent = 'Iniciar Jogo';

  if (autoPlayInterval) clearInterval(autoPlayInterval);
  autoPlayInterval = null;
  autoPlaying = false;
  autoPlayBtn.textContent = 'Modo Auto (Empate)';
}

// Estado inicial
updateTheoryBanner();
typeset();
