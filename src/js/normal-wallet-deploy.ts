import { beginCell, external, internal, MessageRelaxed, storeMessageRelaxed } from "@ton/core";
import { TonClient, WalletContractV3R1, WalletContractV3R2, WalletContractV4 } from "@ton/ton";
import { KeyPair, keyPairFromSecretKey, sign } from "@ton/crypto";
import simpleWallet from "../../data/wallet-simple.json"
import { getEnv, loadKeyPair } from "./utils";
import dotenv from "dotenv"

dotenv.config({ quiet: true });

// fund your wallet before deploying it

async function main() {
    const client = new TonClient({
        endpoint: getEnv("TONCENTER_ENDPOINT_TESTNET"),
        apiKey: getEnv("TONCENTER_API_KEY"),
    });

    const keyPair: KeyPair = loadKeyPair(simpleWallet.keyPair);

    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });
    console.log("Wallet address:", wallet.address.toString());

    const state = await client.getContractState(wallet.address);
    // console.log({ state })
    
    if (state.state == 'uninitialized') {
        const openedWallet = client.open(wallet);
        const seqno = await openedWallet.getSeqno();

        // --- 1. Build internal message you want to send
        const message = internal({
            to: wallet.address,
            value: "0.01",
            body: beginCell().storeUint(0, 32).storeStringTail("hello").endCell(),
            bounce: true,
        })

        // ---- 2. Build signing message manually
        const expireAt = Math.floor(Date.now() / 1000) + 60; // valid for 60s
        const signingMessage = beginCell()
            .storeUint(wallet.walletId, 32)
            .storeUint(expireAt, 32)
            .storeUint(seqno, 32)
            .storeRef(beginCell().store(storeMessageRelaxed(message)).endCell()) // messages
            .endCell();

        const hash = signingMessage.hash();
        console.log("Hash to sign:", hash.toString("hex"));

        // ---- 3. Sign externally (demo: local signing)
        const signature = sign(hash, keyPair.secretKey);

        // ---- 4. Assemble external message
        const external = beginCell()
            .storeBuffer(signature) // 64 bytes
            // .storeBuilder(signingMessage.beginParse())
            .storeSlice(signingMessage.beginParse())
            .endCell();

        // ---- 5. Send it
        await openedWallet.send(external);

        // console.log("Transaction sent!");
    }
    else {
        console.log("Already deployed.")
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0))