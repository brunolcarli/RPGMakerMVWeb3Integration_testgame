/*:
 * @plugindesc Web3 Wallet + NFT + Backend Integration for RPG Maker MV
 * @author Bruno + ChatGPT
 */

(function() {
    "use strict";

    // ============================================================
    // CONFIG
    // ============================================================

    const CONTRACTS = {
        sword: {
            address: "0x5b5357a3db207e0a5f72c3d3c5d2eed40f42779c",
            abi: [
                "function claimSword()",
                "function upgradeSword()",
                "function hasSword(address player) view returns (bool)",
                "function getPlayerSwordId(address player) view returns (uint256)",
                "function getWeaponStats(uint256 tokenId) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            ]
        },

        dragonSlayer: {
            address: "0x76f005636ec1019b02f5ddb42569b343fb7857d6",
            abi: [
                "function claimDragonSlayer()",
                "function hasDragonSlayer(address player) view returns (bool)",
                "function getPlayerBadgeId(address player) view returns (uint256)"
            ]
        }
    };

    const GRAPHQL_ENDPOINT = "https://dragonsdenapi.beelzeware.dev/graphql/";

    const VAR_WALLET = 1;
    const VAR_CHAIN_ID = 2;
    const VAR_ETH_BALANCE = 3;

    const SWITCH_HAS_SWORD = 10;
    const SWITCH_HAS_DRAGON_SLAYER = 11;

    const WEAPON_BLOCKCHAIN_SWORD = 1;

    const SEPOLIA_CHAIN_ID = "0xaa36a7";

    let mapWindowHidden = false;

    // ============================================================
    // HELPERS
    // ============================================================

    function shortWallet(address) {
        if (!address) return "Not connected";
        return address.slice(0, 6) + "..." + address.slice(-4);
    }

    function networkName(chainId) {
        if (!chainId) return "No network";
        if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia";
        return "Wrong Network";
    }

    function getProvider() {
        return new ethers.BrowserProvider(window.ethereum);
    }

    async function getSigner() {
        return await getProvider().getSigner();
    }

    async function getSwordContractWithProvider() {
        return new ethers.Contract(
            CONTRACTS.sword.address,
            CONTRACTS.sword.abi,
            getProvider()
        );
    }

    async function getSwordContractWithSigner() {
        return new ethers.Contract(
            CONTRACTS.sword.address,
            CONTRACTS.sword.abi,
            await getSigner()
        );
    }

    async function getDragonSlayerContractWithProvider() {
        return new ethers.Contract(
            CONTRACTS.dragonSlayer.address,
            CONTRACTS.dragonSlayer.abi,
            getProvider()
        );
    }

    async function getDragonSlayerContractWithSigner() {
        return new ethers.Contract(
            CONTRACTS.dragonSlayer.address,
            CONTRACTS.dragonSlayer.abi,
            await getSigner()
        );
    }

    async function switchToSepolia() {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0xaa36a7" }]
            });

            return true;

        } catch (switchError) {
            console.error("Switch network error:", switchError);

            try {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0xaa36a7",
                        chainName: "Sepolia",
                        nativeCurrency: {
                            name: "Sepolia ETH",
                            symbol: "ETH",
                            decimals: 18
                        },
                        rpcUrls: ["https://rpc.sepolia.org"],
                        blockExplorerUrls: ["https://sepolia.etherscan.io"]
                    }]
                });

                return true;

            } catch (addError) {
                console.error("Add Sepolia error:", addError);
                return false;
            }
        }
    }

    // ============================================================
    // SWORD NFT
    // ============================================================

    async function checkHasSword() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            console.warn("No wallet connected.");
            return false;
        }

        const contract = await getSwordContractWithProvider();
        const hasSword = await contract.hasSword(wallet);

        $gameSwitches.setValue(SWITCH_HAS_SWORD, hasSword);

        if (hasSword) {
            const tokenId = await contract.getPlayerSwordId(wallet);
            const stats = await contract.getWeaponStats(tokenId);

            console.log("Sword Token ID:", tokenId);
            console.log("Sword Stats:", stats);

            const sword = $dataWeapons[WEAPON_BLOCKCHAIN_SWORD];

            // RPG Maker MV params:
            // [MHP, MMP, ATK, DEF, MAT, MDF, AGI, LUK]
            sword.params[0] = Number(stats[7]); // Max HP
            sword.params[1] = Number(stats[8]); // Max MP
            sword.params[2] = Number(stats[1]); // ATK
            sword.params[3] = Number(stats[2]); // DEF
            sword.params[4] = Number(stats[3]); // MAT
            sword.params[5] = Number(stats[4]); // MDF
            sword.params[6] = Number(stats[5]); // AGI
            sword.params[7] = Number(stats[6]); // LUK

            if (!$gameParty.hasItem(sword)) {
                $gameParty.gainItem(sword, 1);
            }

            const actor = $gameParty.leader();

            if (actor && actor.canEquip(sword)) {
                actor.changeEquip(0, sword);
                actor.refresh();
            }

            $gameParty.members().forEach(actor => actor.refresh());
        }

        console.log("Wallet:", wallet);
        console.log("Has Sword:", hasSword);

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

        const alreadyHasSword = await contract.hasSword(wallet);

        if (alreadyHasSword) {
            await checkHasSword();
            $gameMessage.add("You already have the Blockchain Sword.");
            return;
        }

        const tx = await contract.claimSword();

        console.log("Sword TX:", tx.hash);

        await tx.wait();

        console.log("Sword claimed!");

        await checkHasSword();

        $gameMessage.add("You obtained the Blockchain Sword!");
    }

    async function upgradeSword() {
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

        const tx = await contract.upgradeSword();

        console.log("Upgrade TX:", tx.hash);

        await tx.wait();

        console.log("Sword upgraded!");

        await checkHasSword();

        $gameMessage.add("Your Blockchain Sword has been upgraded!");
    }

    // ============================================================
    // DRAGON SLAYER NFT
    // ============================================================

    async function checkHasDragonSlayer() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            return false;
        }

        const contract = await getDragonSlayerContractWithProvider();
        const hasBadge = await contract.hasDragonSlayer(wallet);

        $gameSwitches.setValue(SWITCH_HAS_DRAGON_SLAYER, hasBadge);

        console.log("Has Dragon Slayer:", hasBadge);

        return hasBadge;
    }

    async function claimDragonSlayer() {
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

        const contract = await getDragonSlayerContractWithSigner();

        const alreadyHasBadge = await contract.hasDragonSlayer(wallet);

        if (alreadyHasBadge) {
            await checkHasDragonSlayer();
            $gameMessage.add("You already have the Dragon Slayer NFT.");
            return;
        }

        const tx = await contract.claimDragonSlayer();

        console.log("Dragon Slayer TX:", tx.hash);

        await tx.wait();

        console.log("Dragon Slayer claimed!");

        await checkHasDragonSlayer();

        $gameMessage.add("Dragon Slayer NFT unlocked!");
    }

    // ============================================================
    // WALLET CONNECTION
    // ============================================================

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
                const switched = await switchToSepolia();

                if (!switched) {
                    alert("Please switch your wallet to Sepolia.");
                    return;
                }

                const newChainId = await window.ethereum.request({
                    method: "eth_chainId"
                });

                $gameVariables.setValue(VAR_CHAIN_ID, newChainId);

                if (newChainId !== SEPOLIA_CHAIN_ID) {
                    alert("Wrong network. Please switch to Sepolia.");
                    return;
                }
            }

            const provider = getProvider();
            const balance = await provider.getBalance(wallet);
            const eth = ethers.formatEther(balance);

            $gameVariables.setValue(VAR_ETH_BALANCE, eth);

            console.log("Carteira conectada:", wallet);
            console.log("Chain:", chainId);
            console.log("Balance:", eth);

            await checkHasSword();
            await checkHasDragonSlayer();
            await loadOrCreatePlayerProgress();

            mapWindowHidden = true;

            if (scene && scene._web3WalletWindow) {
                scene._web3WalletWindow.refresh();
                scene._web3WalletWindow.hide();
            }

        } catch (error) {
            console.error("Erro ao conectar carteira:", error);
        }
    }

    // ============================================================
    // BACKEND / GRAPHQL
    // ============================================================

    async function loadOrCreatePlayerProgress() {
        const progress = await loadPlayerProgress();

        if (!progress) {
            console.log("No progress found. Creating initial save...");
            await savePlayerProgress();
            return;
        }

        applyPlayerProgress(progress);
    }

    async function loadPlayerProgress() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            return null;
        }

        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: `
                    query PlayerProgress($wallet: String!) {
                        playerProgress(wallet: $wallet) {
                            wallet
                            actorId
                            name
                            level
                            exp
                            hp
                            mp
                            mhp
                            mmp
                            atk
                            defense
                            mat
                            mdf
                            agi
                            luk
                            gold
                            mapId
                            x
                            y
                        }
                    }
                `,
                variables: {
                    wallet
                }
            })
        });

        const json = await response.json();

        if (json.errors || !json.data || !json.data.playerProgress) {
            console.warn("Progress not found:", json.errors);
            return null;
        }

        return json.data.playerProgress;
    }

    function applyPlayerProgress(progress) {
        const actor = $gameActors.actor(progress.actorId || 1);

        actor.changeLevel(progress.level, false);

        const currentExp = actor.currentExp();
        const diffExp = progress.exp - currentExp;

        if (diffExp > 0) {
            actor.gainExp(diffExp);
        }

        actor.setHp(progress.hp);
        actor.setMp(progress.mp);

        const currentGold = $gameParty.gold();
        const diffGold = progress.gold - currentGold;

        if (diffGold > 0) {
            $gameParty.gainGold(diffGold);
        } else if (diffGold < 0) {
            $gameParty.loseGold(Math.abs(diffGold));
        }

        $gamePlayer.reserveTransfer(
            progress.mapId,
            progress.x,
            progress.y,
            2,
            0
        );

        actor.refresh();

        console.log("Progress loaded:", progress);
    }

    async function savePlayerProgress() {
        const wallet = $gameVariables.value(VAR_WALLET);

        if (!wallet) {
            console.warn("Cannot save progress: no wallet connected.");
            return;
        }

        const actor = $gameActors.actor(1);

        const payload = {
            query: `
                mutation SavePlayerProgress($input: SavePlayerProgressInput!) {
                    savePlayerProgress(input: $input) {
                        ok
                        playerProgress {
                            wallet
                        }
                    }
                }
            `,
            variables: {
                input: {
                    wallet: wallet,
                    actorId: actor.actorId(),
                    name: actor.name(),
                    level: actor.level,
                    exp: actor.currentExp(),
                    hp: actor.hp,
                    mp: actor.mp,
                    mhp: actor.mhp,
                    mmp: actor.mmp,
                    atk: actor.atk,
                    defense: actor.def,
                    mat: actor.mat,
                    mdf: actor.mdf,
                    agi: actor.agi,
                    luk: actor.luk,
                    gold: $gameParty.gold(),
                    mapId: $gameMap.mapId(),
                    x: $gamePlayer.x,
                    y: $gamePlayer.y
                }
            }
        };

        console.log("Saving progress:", payload.variables.input);

        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const json = await response.json();

        console.log("Save response:", json);

        return json;
    }

    // ============================================================
    // MAP WALLET WINDOW
    // ============================================================

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
            this.drawText("Use New Game or Menu", 0, 36, this.contentsWidth(), "center");
        }
    };

    // ============================================================
    // MENU WEB3 WINDOW
    // ============================================================

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

            if ($gameSwitches.value(SWITCH_HAS_DRAGON_SLAYER)) {
                text += " | Dragon Slayer";
            }
        }

        this.drawText(text, 0, 0, this.contentsWidth(), "left");
    };

    // ============================================================
    // SCENE MAP
    // ============================================================

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;

    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        this._web3WalletWindow = new Window_Web3Wallet(20, 20, 520, 100);
        this.addWindow(this._web3WalletWindow);

        if ($gameVariables.value(VAR_WALLET) || mapWindowHidden) {
            this._web3WalletWindow.hide();
        }
    };

    // ============================================================
    // SCENE MENU
    // ============================================================

    const _Window_MenuCommand_addOriginalCommands =
        Window_MenuCommand.prototype.addOriginalCommands;

    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        this.addCommand("Connect Wallet", "connectWallet", true);
        this.addCommand("Save Progress", "saveProgress", true);
    };

    const _Scene_Menu_createCommandWindow =
        Scene_Menu.prototype.createCommandWindow;

    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);

        this._commandWindow.setHandler(
            "connectWallet",
            this.commandConnectWallet.bind(this)
        );

        this._commandWindow.setHandler(
            "saveProgress",
            this.commandSaveProgress.bind(this)
        );
    };

    Scene_Menu.prototype.commandConnectWallet = function() {
        this._commandWindow.activate();
        Web3Game.connectWallet(this);
    };

    Scene_Menu.prototype.commandSaveProgress = function() {
        this._commandWindow.activate();
        Web3Game.savePlayerProgress();
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

    // ============================================================
    // AUTO CONNECT ON NEW GAME
    // ============================================================

    const _Scene_Title_commandNewGame =
        Scene_Title.prototype.commandNewGame;

    Scene_Title.prototype.commandNewGame = function() {
        _Scene_Title_commandNewGame.call(this);

        setTimeout(function() {
            Web3Game.connectWallet(SceneManager._scene);
        }, 700);
    };

    // ============================================================
    // PUBLIC API
    // ============================================================

    window.Web3Game = {
        connectWallet,

        checkHasSword,
        claimSword,
        upgradeSword,

        checkHasDragonSlayer,
        claimDragonSlayer,

        loadOrCreatePlayerProgress,
        loadPlayerProgress,
        savePlayerProgress,

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
        },

        hasDragonSlayer() {
            return $gameSwitches.value(SWITCH_HAS_DRAGON_SLAYER);
        }
    };

})();