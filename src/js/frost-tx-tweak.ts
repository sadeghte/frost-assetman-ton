import { beginCell, Cell, external, internal, MessageRelaxed, storeMessageRelaxed } from "@ton/core";
import { TonClient, WalletContractV3R1, WalletContractV3R2, WalletContractV4, WalletContractV5R1 } from "@ton/ton";
import { KeyPair, keyPairFromSecretKey, sign } from "@ton/crypto";
import sharedWallet from "../../data/wallet-shared.json"
import { frostSign, getEnv, hashStr, loadKeyPair, tweakWallet } from "./utils";
import dotenv from "dotenv"
let { ed25519 } = require("frost-lib");

const frost = ed25519;
dotenv.config({ quiet: true });

// fund your wallet before deploying it

async function main() {
    const client = new TonClient({
        endpoint: getEnv("TONCENTER_ENDPOINT_TESTNET"),
        apiKey: getEnv("TONCENTER_API_KEY"),
    });

    const { participants } = sharedWallet;

    // Tweak wallet
    const tweakBy = hashStr("sample-deposit-wallet");
    const tweakedWallet = tweakWallet(sharedWallet, tweakBy)

    // load wallets
    const pubkeyPackage = tweakedWallet.pubkeyPackages[participants[0]]
    const publicKey = Buffer.from(pubkeyPackage['verifying_key'], "hex");
    const walletV4 = WalletContractV4.create({ workchain: 0, publicKey });
    console.log("Wallet address:", walletV4.address.toString());

    const openedWallet = client.open(walletV4);
    const seqno = await openedWallet.getSeqno();

    const message = internal({
        to: walletV4.address,
        value: "0.01",
        body: beginCell().storeUint(0, 32).storeStringTail("Hello world").endCell(),
        bounce: true,
    })

    const deployment = await walletV4.createTransfer({
        seqno: seqno,
        messages: [message],
        signer: async (c: Cell): Promise<Buffer> => {
            console.log("Cell: ", c.beginParse().asCell().toString())

            const hash = c.hash();
            console.log("Hash to sign:", hash.toString("hex"));

            return frostSign(hash.toString("hex"), tweakedWallet.keyPackages, pubkeyPackage);
        }
    })

    await openedWallet.send(deployment);
    console.log("Transaction sent!");

}

main()
    .catch(console.error)
    .finally(() => {
        console.log("Done.")
        process.exit(0)
    })