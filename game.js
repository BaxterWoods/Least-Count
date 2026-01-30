/**
 * LEAST COUNT - BAXTERWOODS SECURE EDITION
 */
(function() {
    // SECURITY: Domain Locking to your specific GitHub URL
    const host = window.location.hostname;
    const authorizedDomain = "baxterwoods.github.io"; 
    
    // Allows local testing OR your specific GitHub site
    const isAllowed = host === authorizedDomain || host === "localhost" || host === "127.0.0.1" || host === "";
    
    if (!isAllowed) {
        document.body.innerHTML = `
            <div style="color:white;text-align:center;margin-top:100px;font-family:sans-serif;">
                <h1>403 Forbidden</h1>
                <p>This software is protected. Unauthorized mirroring is prohibited.</p>
                <p>Official Version: <a href="https://${authorizedDomain}/Least-Count/" style="color:cyan;">Click Here</a></p>
            </div>`;
        throw new Error("Piracy Protection Triggered");
    }

    // EXTRA SECURITY: Disable Right-Click and Common DevTool Shortcuts
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.onkeydown = function(e) {
        if (e.keyCode == 123) return false; // F12
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false; // Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false; // Ctrl+Shift+J
        if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false; // Ctrl+U (View Source)
    };
})();

// --- GAME CONFIGURATION ---
const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class Card {
    constructor(suit, value, isJoker = false) {
        this.suit = suit; this.value = value; this.isJoker = isJoker;
    }
    getPointValue(roundJokerValue) {
        if (this.isJoker || this.value === roundJokerValue) return 0;
        if (this.value === 'K' && (this.suit === '♥' || this.suit === '♦')) return -1;
        if (['J', 'Q', 'K'].includes(this.value)) return 10;
        if (this.value === 'A') return 1;
        return parseInt(this.value);
    }
    toString() { return this.isJoker ? "JK" : `${this.value}${this.suit}`; }
}

const multiplayer = {
    peer: null, conn: null, connections: [], isHost: false,
    userName: "", players: [], roomID: "",
    maxRounds: 5, currentRound: 1,

    init() {
        this.userName = document.getElementById('username').value || "Player";
        this.peer = new Peer();
        this.peer.on('open', id => {
            this.roomID = id;
            document.getElementById('display-room-code').innerText = id;
            if (!this.isHost) this.connectToHost();
        });
        this.peer.on('connection', c => {
            this.connections.push(c);
            this.setupListener(c);
        });
    },

    connectToHost() {
        const targetID = document.getElementById('room-id-input').value;
        this.conn = this.peer.connect(targetID);
        this.setupListener(this.conn);
        this.conn.on('open', () => this.conn.send({ type: 'JOIN', name: this.userName }));
    },

    setupListener(c) {
        c.on('data', data => {
            if (data.type === 'JOIN') {
                this.players.push({ name: data.name, conn: c });
                this.updateLobbyList();
                this.broadcast({ type: 'LOBBY_UPDATE', list: this.getPlayerNames() });
            }
            if (data.type === 'LOBBY_UPDATE') this.updateLobbyList(data.list);
            if (data.type === 'START_GAME') {
                this.maxRounds = data.rounds;
                ui.switchToGame();
                game.syncGame(data.gameState);
            }
        });
    },

    getPlayerNames() { return [this.userName, ...this.players.map(p => p.name)]; },
    broadcast(data) { this.connections.forEach(c => c.send(data)); },

    updateLobbyList(list = null) {
        const displayList = list || this.getPlayerNames();
        document.getElementById('player-list-ul').innerHTML = displayList.map(n => `<li>${n}</li>`).join('');
    },

    startGame() {
        this.maxRounds = parseInt(document.getElementById('setting-rounds').value);
        game.initGame();
        this.broadcast({ 
            type: 'START_GAME', 
            rounds: this.maxRounds,
            gameState: { roundJoker: game.roundJoker, discard: game.discard }
        });
        ui.switchToGame();
    }
};

const ui = {
    showLobby(isHost) {
        if (!document.getElementById('username').value) return alert("Enter name!");
        multiplayer.isHost = isHost;
        document.getElementById('screen-login').style.display = 'none';
        document.getElementById('screen-lobby').style.display = 'block';
        if (isHost) {
            document.getElementById('host-controls').style.display = 'block';
            document.getElementById('btn-start-game').style.display = 'inline-block';
        }
        multiplayer.init();
    },
    switchToGame() {
        document.getElementById('screen-lobby').style.display = 'none';
        document.getElementById('screen-game').style.display = 'block';
        document.getElementById('round-number').innerText = `Round: 1 / ${multiplayer.maxRounds}`;
    },
    copyLink() {
        const url = window.location.origin + window.location.pathname + "?room=" + multiplayer.roomID;
        navigator.clipboard.writeText(url);
        alert("Invite Link Copied!");
    }
};

const game = {
    deck: [], discard: [], roundJoker: null,
    playerHand: [], scores: [], state: 'START', selected: new Set(),

    initGame() { this.startRound(); },

    syncGame(data) {
        this.roundJoker = new Card(data.roundJoker.suit, data.roundJoker.value, data.roundJoker.isJoker);
        this.discard = data.discard.map(c => new Card(c.suit, c.value, c.isJoker));
        this.startRound();
    },

    startRound() {
        this.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => this.deck.push(new Card(s, v))));
        this.deck.push(new Card(null, null, true), new Card(null, null, true));
        this.shuffle();
        this.roundJoker = this.deck.pop();
        this.discard = [this.deck.pop()];
        this.playerHand = this.deck.splice(0, 7);
        this.state = 'START';
        this.updateUI();
    },

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    },

    handlePick(src) {
        if (this.state !== 'START') return;
        this.playerHand.push(src === 'deck' ? this.deck.pop() : this.discard.pop());
        this.state = 'DROP';
        this.updateUI();
    },

    handleMatchDrop() {
        if (this.state !== 'START' || this.selected.size === 0) return;
        const cards = Array.from(this.selected).map(i => this.playerHand[i]);
        if (cards.every(c => c.value === this.discard[this.discard.length - 1].value)) {
            this.executeDrop(cards);
            this.state = 'START'; 
            this.updateUI();
        } else alert("Value doesn't match!");
    },

    handleStandardDrop() {
        if (this.state !== 'DROP' || this.selected.size === 0) return;
        const cards = Array.from(this.selected).map(i => this.playerHand[i]);
        if (new Set(cards.map(c => c.value)).size === 1 || cards.some(c => c.isJoker)) {
            this.executeDrop(cards);
            this.state = 'START';
            this.updateUI();
        } else alert("Invalid drop!");
    },

    executeDrop(cards) {
        this.discard.push(...cards);
        this.playerHand = this.playerHand.filter((_, i) => !this.selected.has(i));
        this.selected.clear();
        if (this.playerHand.length === 0) this.resolveRound();
    },

    resolveRound() {
        if (multiplayer.currentRound < multiplayer.maxRounds) {
            multiplayer.currentRound++;
            document.getElementById('round-number').innerText = `Round: ${multiplayer.currentRound} / ${multiplayer.maxRounds}`;
            this.startRound();
        } else {
            const winner = "The player with least points"; 
            alert("Game Over! " + winner + " wins.");
            this.state = 'FINISHED';
        }
    },

    updateUI() {
        const handDiv = document.getElementById('player-hand');
        handDiv.innerHTML = this.playerHand.map((c, i) => `
            <div class="card ${['♥','♦'].includes(c.suit)?'red':''} ${this.selected.has(i)?'selected':''}" onclick="game.toggle(${i})">
                ${c.toString()}
            </div>
        `).join('');
        const top = this.discard[this.discard.length-1];
        document.getElementById('discard-pile').innerText = top ? top.toString() : '-';
        document.getElementById('discard-pile').className = `card ${top && ['♥','♦'].includes(top.suit)?'red':''}`;
        document.getElementById('btn-match').disabled = this.state !== 'START';
        document.getElementById('btn-drop').disabled = this.state !== 'DROP';
        document.getElementById('hand-points').innerText = `Points: ${this.playerHand.reduce((s, c) => s + c.getPointValue(this.roundJoker.value), 0)}`;
    },

    toggle(i) {
        if (this.state === 'FINISHED') return;
        this.selected.has(i) ? this.selected.delete(i) : this.selected.add(i);
        this.updateUI();
    }
};

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('room')) document.getElementById('room-id-input').value = params.get('room');
};