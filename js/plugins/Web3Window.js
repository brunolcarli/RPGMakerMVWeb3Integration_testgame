/*:
 * @plugindesc Web3 Wallet Connection for RPG Maker MV
 * @author Bruno + ChatGPT
 */

(function() {

    const SWORD_CLAIM_ADDRESS = "0x5b5357a3db207e0a5f72c3d3c5d2eed40f42779c";

    const SWORD_CLAIM_ABI = [
        "function claimSword()",
        "function upgradeSword()",
        "function hasSword(address player) view returns (bool)",
        "function getPlayerSwordId(address player) view returns (uint256)",
        "function getWeaponStats(uint256 tokenId) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
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

        $gameSwitches.setValue(10, hasSword);

        if (hasSword) {

            const tokenId =
                await contract.getPlayerSwordId(wallet);

            const stats =
                await contract.getWeaponStats(tokenId);

            console.log("Token ID:", tokenId);
            console.log("Stats:", stats);

            // RPG Maker MV params:
            // [MHP, MMP, ATK, DEF, MAT, MDF, AGI, LUK]

            $dataWeapons[1].params[0] = Number(stats[7]); // Max HP
            $dataWeapons[1].params[1] = Number(stats[8]); // Max MP
            $dataWeapons[1].params[2] = Number(stats[1]); // ATK
            $dataWeapons[1].params[3] = Number(stats[2]); // DEF
            $dataWeapons[1].params[4] = Number(stats[3]); // MAT
            $dataWeapons[1].params[5] = Number(stats[4]); // MDF
            $dataWeapons[1].params[6] = Number(stats[5]); // AGI
            $dataWeapons[1].params[7] = Number(stats[6]); // LUK

            if (!$gameParty.hasItem($dataWeapons[1])) {
                $gameParty.gainItem($dataWeapons[1], 1);
            }

            $dataWeapons[1].params[2] = Number(stats[1]); // ATK
            $gameParty.members().forEach(actor => actor.refresh());
        }

        console.log("Wallet:", wallet);
        console.log("Has sword:", hasSword);

        if (hasSword) {
            const sword = $dataWeapons[WEAPON_BLOCKCHAIN_SWORD];

            if (!$gameParty.hasItem(sword)) {
                $gameParty.gainItem(sword, 1);
            }

            const actor = $gameParty.leader();

            if (actor && actor.canEquip(sword)) {
                actor.changeEquip(0, sword); // 0 = slot de arma
                actor.refresh();
            }
        }

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

    async function upgradeSword() {

        const provider =
            new ethers.BrowserProvider(window.ethereum);

        const signer =
            await provider.getSigner();

        const contract =
            new ethers.Contract(
                SWORD_CLAIM_ADDRESS,
                SWORD_CLAIM_ABI,
                signer
            );

        const tx = await contract.upgradeSword();

        console.log("TX:", tx.hash);

        await tx.wait();

        console.log("Sword upgraded!");

        await checkHasSword();
        $gameMessage.add("Your Blockchain Sword has been upgraded!");
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

    // const _Scene_Map_update = Scene_Map.prototype.update;

    // Scene_Map.prototype.update = function() {
    //     _Scene_Map_update.call(this);

    //     if (Input.isTriggered("pageup")) {
    //         connectWallet(this);
    //     }
    // };

    // ----------------------------------------
    // Scene Menu

    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;

    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        this.addCommand("Connect Wallet", "connectWallet", true);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;

    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("connectWallet", this.commandConnectWallet.bind(this));
    };

    Scene_Menu.prototype.commandConnectWallet = function() {
        this._commandWindow.activate();
        Web3Game.connectWallet(this);
    };

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
    // Auto connect wallet on New Game

    const _Scene_Title_commandNewGame = Scene_Title.prototype.commandNewGame;

    Scene_Title.prototype.commandNewGame = async function() {
        _Scene_Title_commandNewGame.call(this);

        setTimeout(async function() {
            await Web3Game.connectWallet(SceneManager._scene);
        }, 500);
    };

    // ----------------------------------------
    // Public API

    window.Web3Game = {
        connectWallet,
        checkHasSword,
        claimSword,
        upgradeSword: upgradeSword,

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