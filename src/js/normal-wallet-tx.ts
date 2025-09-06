import { beginCell, Cell, internal, SendMode, storeMessageRelaxed } from "@ton/core";
import { TonClient, WalletContractV3R1, WalletContractV4 } from "@ton/ton";
import { sign, KeyPair } from "@ton/crypto"; // default signer example
import simpleWallet from "../../data/wallet-simple.json"
import { loadKeyPair, getEnv } from "./utils"
import dotenv from "dotenv"

dotenv.config({ quiet: true });

async function main() {
    const client = new TonClient({
        endpoint: getEnv("TONCENTER_ENDPOINT_TESTNET"),
        apiKey: getEnv("TONCENTER_API_KEY"),
    });

    const keyPair: KeyPair = loadKeyPair(simpleWallet.keyPair);

    const walletV4 = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });
    console.log("Wallet V4 address:", walletV4.address.toString({
        bounceable: false,
        testOnly: true,
    }));

    const walletV3 = WalletContractV3R1.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });
    console.log("Wallet V3 address:", walletV3.address.toString());

    const openedWallet = client.open(walletV4);
    const seqno = await openedWallet.getSeqno();

    console.log({ seqno })

    // --- 1. Build internal message you want to send
    const message = internal({
        to: walletV3.address,
        value: "0.01",
        body: beginCell().storeUint(0, 32).storeStringTail("hello").endCell(),
        bounce: false,
    })

    const transfer = await openedWallet.createTransfer({
        seqno,
        messages: [message],
        signer: async (c: Cell): Promise<Buffer> => {
            console.log("Cell: ", c.beginParse().toString())

            const hash = c.hash();
            console.log("Hash to sign:", hash.toString("hex"));

            return sign(hash, keyPair.secretKey);
        }
    })

    // ---- 5. Send it
    await openedWallet.send(transfer);

    console.log("Transaction sent!");
}

main()
    .catch(console.error)
    .finally(() => process.exit(0))
