import { WalletContractV3R2, WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import { frostKeyGen } from './utils'
import fs from "fs";
let { ed25519 } = require("frost-lib");
const frost = ed25519;

const {participants, pubkeyPackages, keyPackages} = frostKeyGen(3, 2);
const publicKey = Buffer.from(pubkeyPackages[participants[0]]["verifying_key"], "hex")

const walletV3R2 = WalletContractV3R2.create({workchain: 0, publicKey})
const walletV4 = WalletContractV4.create({workchain: 0, publicKey})
const walletV5R1 = WalletContractV5R1.create({workchain: 0, publicKey})

const jsonString = JSON.stringify({
    walletV3R2: walletV3R2.address.toString(),
    walletV4: walletV4.address.toString(),
    walletV5R1: walletV5R1.address.toString(),
    participants, 
    pubkeyPackages, 
    keyPackages, 
}, null, 4);

// Write to file
fs.writeFileSync("./data/wallet-shared.json", jsonString, { flag: "wx" });

console.log("JSON file saved successfully!");