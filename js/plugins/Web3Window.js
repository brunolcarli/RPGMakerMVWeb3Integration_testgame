/*:
 * @plugindesc Web3 Wallet Connection for RPG Maker MV
 * @author Bruno + ChatGPT
 */

(function() {

    const SWORD_CLAIM_ADDRESS = "0xf309a7083C97BCfd6DE6c5bb8cCAAD55e8A9Bb3e";

    const SWORD_CLAIM_ABI = [
        {
            "inputs": [{"internalType": "address", "name": "", "type": "address"}],
            "name": "hasSword",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "claimSword",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const VAR_WALLET = 1;
    const VAR_CHAIN_ID = 2;
    const VAR_ETH_BALANCE = 3;
    const SWITCH_HAS_SWORD = 10;
    const WEAPON_BLOCKCHAIN_SWORD = 1;
    const SEPOLIA_CHAIN_ID = "0xaa36a7";

    let mapWindowHidden = false;

    function shortWallet(address) {
        if (!address) return "Not connected";
        return address.slice(0, 6) + "..." + address.slice(-4);
    }

    function networkName(chainId) {
        if (!chainId) return "No network";
        if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia";
        return "Wrong Network";
    }

    async function getSwordContractWithProvider() {
        const provider = new ethers.BrowserProvider(window.ethereum);

        return new ethers.Contract(
            SWORD_CLAIM_ADDRESS,
            SWORD_CLAIM_ABI,
            provider
        );
    }

    async function getSwordContractWithSigner() {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        return new ethers.Contract(
            SWORD_CLAIM_ADDRESS,
            SWORD_CLAIM_ABI,
            signer
        );
    }

    async function checkHasSword() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            console.warn("No wallet connected.");
            return false;
        }

        const contract = await getSwordContractWithProvider();
        const hasSword = await contract.hasSword(wallet);

        $gameSwitches.setValue(SWITCH_HAS_SWORD, hasSword);

        if (hasSword && !$gameParty.hasItem($dataWeapons[WEAPON_BLOCKCHAIN_SWORD])) {
            $gameParty.gainItem($dataWeapons[WEAPON_BLOCKCHAIN_SWORD], 1);
        }

        console.log("Wallet:", wallet);
        console.log("Has sword:", hasSword);

        return hasSword;
    }

    async function claimSword() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            alert("Connect your wallet first.");
            return;
        }

        const chainId = $gameVariables.value(VAR_CHAIN_ID);

        if (chainId !== SEPOLIA_CHAIN_ID) {
            alert("Please switch your wallet to Sepolia.");
            return;
        }

        const contract = await getSwordContractWithSigner();
        const tx = await contract.claimSword();

        console.log("TX:", tx.hash);

        await tx.wait();

        console.log("Sword claimed!");

        await checkHasSword();

        if (!$gameParty.hasItem($dataWeapons[WEAPON_BLOCKCHAIN_SWORD])) {
            $gameParty.gainItem($dataWeapons[WEAPON_BLOCKCHAIN_SWORD], 1);
        }

        $gameMessage.add("You obtained the Blockchain Sword!");
    }

    async function connectWallet(scene) {
        if (!window.ethereum) {
            alert("Nenhuma carteira Web3 encontrada. Instale MetaMask ou OKX Wallet.");
            return;
        }

        try {
            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts"
            });

            const wallet = accounts[0];

            $gameVariables.setValue(VAR_WALLET, wallet);

            const chainId = await window.ethereum.request({
                method: "eth_chainId"
            });

            $gameVariables.setValue(VAR_CHAIN_ID, chainId);

            if (chainId !== SEPOLIA_CHAIN_ID) {
                alert("Please switch your wallet to Sepolia.");
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const balance = await provider.getBalance(wallet);
            const eth = ethers.formatEther(balance);

            $gameVariables.setValue(VAR_ETH_BALANCE, eth);

            console.log("Carteira conectada:", wallet);
            console.log("Chain:", chainId);
            console.log("Balance:", eth);

            await checkHasSword();

            mapWindowHidden = true;

            if (scene && scene._web3WalletWindow) {
                scene._web3WalletWindow.refresh();
                scene._web3WalletWindow.hide();
            }

        } catch (error) {
            console.error("Erro ao conectar carteira:", error);
        }
    }

    // ----------------------------------------
    // Map wallet window

    function Window_Web3Wallet() {
        this.initialize.apply(this, arguments);
    }

    Window_Web3Wallet.prototype = Object.create(Window_Base.prototype);
    Window_Web3Wallet.prototype.constructor = Window_Web3Wallet;

    Window_Web3Wallet.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
    };

    Window_Web3Wallet.prototype.refresh = function() {
        this.contents.clear();

        const wallet = $gameVariables.value(VAR_WALLET);

        this.drawText("Web3 Wallet", 0, 0, this.contentsWidth(), "center");

        if (wallet) {
            this.drawText(shortWallet(wallet), 0, 36, this.contentsWidth(), "center");
        } else {
            this.drawText("Pressione Q para conectar", 0, 36, this.contentsWidth(), "center");
        }
    };

    // ----------------------------------------
    // Menu Web3 window

    function Window_Web3Menu() {
        this.initialize.apply(this, arguments);
    }

    Window_Web3Menu.prototype = Object.create(Window_Base.prototype);
    Window_Web3Menu.prototype.constructor = Window_Web3Menu;

    Window_Web3Menu.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
    };

    Window_Web3Menu.prototype.refresh = function() {
        this.contents.clear();

        const wallet = $gameVariables.value(VAR_WALLET);
        const chainId = $gameVariables.value(VAR_CHAIN_ID);
        const balance = $gameVariables.value(VAR_ETH_BALANCE);

        let text = "Web3: " + shortWallet(wallet);

        if (wallet) {
            text += " | " + networkName(chainId);

            if (balance) {
                text += " | " + parseFloat(balance).toFixed(4) + " ETH";
            }
        }

        this.drawText(text, 0, 0, this.contentsWidth(), "left");
    };

    // ----------------------------------------
    // Scene Map

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;

    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        this._web3WalletWindow = new Window_Web3Wallet(20, 20, 520, 100);
        this.addWindow(this._web3WalletWindow);

        if ($gameVariables.value(VAR_WALLET) || mapWindowHidden) {
            this._web3WalletWindow.hide();
        }
    };

    const _Scene_Map_update = Scene_Map.prototype.update;

    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        if (Input.isTriggered("pageup")) {
            connectWallet(this);
        }
    };

    // ----------------------------------------
    // Scene Menu

    const _Scene_Menu_create = Scene_Menu.prototype.create;

    Scene_Menu.prototype.create = function() {
        _Scene_Menu_create.call(this);

        const goldWindow = this._goldWindow;

        const x = 28;
        const y = goldWindow.y;
        const width = Graphics.boxWidth - goldWindow.width - 56;
        const height = goldWindow.height;

        this._web3MenuWindow = new Window_Web3Menu(x, y, width, height);
        this.addWindow(this._web3MenuWindow);
    };

    // ----------------------------------------
    // Public API

    window.Web3Game = {
        connectWallet,
        checkHasSword,
        claimSword,

        getWallet() {
            return $gameVariables.value(VAR_WALLET);
        },

        getChainId() {
            return $gameVariables.value(VAR_CHAIN_ID);
        },

        getEthBalance() {
            return $gameVariables.value(VAR_ETH_BALANCE);
        },

        hasSword() {
            return $gameSwitches.value(SWITCH_HAS_SWORD);
        }
    };

})();