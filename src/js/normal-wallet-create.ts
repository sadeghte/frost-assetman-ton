import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV3R1, WalletContractV3R2, WalletContractV4 } from "@ton/ton";
import { Address } from "@ton/core";
import * as fs from "fs";
import * as path from "path";

const MASTER_CHAIN = 0;

// Generate and save
async function createAndSave(walletPath: string) {
    const dir = path.dirname(walletPath);
    fs.mkdirSync(dir, { recursive: true });

    const mnemonics = await mnemonicNew();

    const keyPair = await mnemonicToPrivateKey(mnemonics);

    const v3r1 = WalletContractV3R1.create({ publicKey: keyPair.publicKey, workchain: MASTER_CHAIN });
    const v3r2 = WalletContractV3R2.create({ publicKey: keyPair.publicKey, workchain: MASTER_CHAIN });
    const v4r1 = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: MASTER_CHAIN });

    fs.writeFileSync(walletPath, JSON.stringify({
        mnemonics,
        keyPair: {
            publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
            secretKey: Buffer.from(keyPair.secretKey).toString("hex"),
        },
        v3r1: v3r1.address.toString({ bounceable: true }),
        v3r2: v3r2.address.toString({ bounceable: true }),
        v4r1: v4r1.address.toString({ bounceable: true }),
    }, null, 4));
    console.log("Saved mnemonics to wallet.json");
}

// Load and derive keys
async function loadAndUse() {
    const data = JSON.parse(fs.readFileSync("wallet.json", "utf-8"));
    const mnemonics: string[] = data.mnemonics;

    const keyPair = await mnemonicToPrivateKey(mnemonics);

    console.log("Public key:", Buffer.from(keyPair.publicKey).toString("hex"));
    console.log("Secret key:", Buffer.from(keyPair.secretKey).toString("hex"));
}

async function main() {
    await createAndSave("data/wallet-simple.json");
}

main()
    .catch(console.error)
    .finally(() => process.exit(0))