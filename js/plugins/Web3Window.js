/*:
 * @plugindesc Web3 Wallet Connection for RPG Maker MV
 * @author Bruno + ChatGPT
 */

(function() {
    // ----------------------------------------
    // Claim SWORD contract ABI
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

    //-------------------------------
    // SWORD CLAIM
    //---------------------------------
    async function checkHasSword() {
        const wallet = $gameVariables.value(1);

        const provider = new ethers.BrowserProvider(window.ethereum);

        const contract = new ethers.Contract(
            SWORD_CLAIM_ADDRESS,
            SWORD_CLAIM_ABI,
            provider
        );

        const hasSword = await contract.hasSword(wallet);

        $gameSwitches.setValue(10, hasSword);

        console.log("Wallet:", wallet);
        console.log("Has sword:", hasSword);

        alert("Has sword: " + hasSword);
    }

    async function claimSword() {

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

        const tx = await contract.claimSword();

        console.log("TX:", tx.hash);

        await tx.wait();

        console.log("Sword claimed!");

        await checkHasSword();
    }


    //--------------------------------------------
    // Wallet connect and wallet window

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

        const wallet = $gameVariables.value(1);

        this.drawText("Web3 Wallet", 0, 0, this.contentsWidth(), "center");

        if (wallet) {
            this.drawText(wallet, 0, 36, this.contentsWidth(), "center");
        } else {
            this.drawText("Pressione W para conectar", 0, 36, this.contentsWidth(), "center");
        }
    };

    function formatEther(wei) {
        const ether = wei / 1000000000000000000n;
        const remainder = wei % 1000000000000000000n;

        return `${ether}.${remainder
            .toString()
            .padStart(18, '0')
            .substring(0, 6)}`;
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

            $gameVariables.setValue(1, accounts[0]);

            if (scene && scene._web3WalletWindow) {
                scene._web3WalletWindow.refresh();
            }

            console.log("Carteira conectada:", accounts[0]);

        } catch (error) {
            console.error("Erro ao conectar carteira:", error);
        }

        const chainId = await window.ethereum.request({
            method: "eth_chainId"
        });
        $gameVariables.setValue(2, chainId);
        console.log(chainId);

        const wallet = $gameVariables.value(1);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(wallet);
        const eth = ethers.formatEther(balance);

        console.log(eth);
        $gameVariables.setValue(3, eth);
    }

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;

    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        this._web3WalletWindow = new Window_Web3Wallet(20, 20, 520, 100);
        this.addWindow(this._web3WalletWindow);
    };

    const _Scene_Map_update = Scene_Map.prototype.update;

    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        if (Input.isTriggered("pageup")) {
            connectWallet(this);
        }
    };

    window.Web3Game = {
        connectWallet: connectWallet,
        checkHasSword: checkHasSword,
        claimSword: claimSword,
        getWallet() {
            return $gameVariables.value(1);
        },
        getChainId() {
            return $gameVariables.value(2);
        },
        getEthBalance() {
            return $gameVariables.value(3);
        },
        hasSword() {
            return $gameSwitches.value(10);
        } 

    };

})();