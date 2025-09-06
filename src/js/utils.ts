import { beginCell, Cell, Message, MessageRelaxed, storeMessage, storeMessageRelaxed } from "@ton/core";
import { KeyPair } from "@ton/crypto";
let { ed25519 } = require("frost-lib");
import { sha3_256 } from '@noble/hashes/sha3';
const frost = ed25519;

export function loadKeyPair(data: { publicKey: string, secretKey: string }): KeyPair {
    return {
        publicKey: Buffer.from(data.publicKey, "hex"),
        secretKey: Buffer.from(data.secretKey, "hex"),
    }
}

export function getEnv(keyName: string): string {
    const value = process.env[keyName];
    if(value === undefined)
        throw `Undefined env key: ${keyName}`;
    return value;
}

export function messageRelaxedToCell(msg: MessageRelaxed): Cell {
    const builder = beginCell();
    builder.store(storeMessageRelaxed(msg)); // storeMessageRelaxed returns a builder function
    return builder.endCell();
}

export function messageToCell(msg: Message): Cell {
    const builder = beginCell();
    builder.store(storeMessage(msg)); // storeMessageRelaxed returns a builder function
    return builder.endCell();
}

export function frostKeyGen(maxSigners: number, minSigners: number) {
    const participants = Array.from({ length: maxSigners }, (v, i) => frost.numToId(i + 1));

    const round1SecretPackages: any = {};
    const receivedRound1Packages: any = {};
    for (let participantIdentifier of participants) {
        let { secret_package, package: pkg } = frost.dkgPart1(
            participantIdentifier,
            maxSigners,
            minSigners
        )

        round1SecretPackages[participantIdentifier] = secret_package;

        for (let receiverParticipantIdentifier of participants) {
            if (receiverParticipantIdentifier == participantIdentifier) {
                continue;
            }
            if (!receivedRound1Packages[receiverParticipantIdentifier])
                receivedRound1Packages[receiverParticipantIdentifier] = {};
            receivedRound1Packages[receiverParticipantIdentifier][participantIdentifier] = pkg;
        }
    }

    const round2SecretPackages: any = {};
    const receivedRound2Packages: any = {};
    for (let participantIdentifier of participants) {
        let round1SecretPackage = round1SecretPackages[participantIdentifier]
        let round1Packages = receivedRound1Packages[participantIdentifier];

        let { secret_package, packages } = frost.dkgPart2(round1SecretPackage, round1Packages);

        round2SecretPackages[participantIdentifier] = secret_package;

        for (let [receiverIdentifier, round2Package] of Object.entries(packages)) {
            if (!receivedRound2Packages[receiverIdentifier])
                receivedRound2Packages[receiverIdentifier] = {}
            receivedRound2Packages[receiverIdentifier][participantIdentifier] = round2Package;
        }
    }

    let keyPackages: any = {};
    let pubkeyPackages: any = {};
    for (let participantIdentifier of participants) {
        let round2SecretPackage = round2SecretPackages[participantIdentifier];
        let round1Packages = receivedRound1Packages[participantIdentifier];
        let round2Packages = receivedRound2Packages[participantIdentifier];

        let { key_package, pubkey_package } = frost.dkgPart3(
            round2SecretPackage,
            round1Packages,
            round2Packages,
        );

        keyPackages[participantIdentifier] = key_package;
        pubkeyPackages[participantIdentifier] = pubkey_package;
    }

    return { participants, keyPackages, pubkeyPackages }
}

export function frostSign(message: string, keyPackages: any, pubkeyPackage: any): Buffer {
    const participants = Object.keys(keyPackages);

    let noncesMap:any = {};
    let commitmentsMap:any = {};
    for (let participantIdentifier of participants) {
        let keyPackage = keyPackages[participantIdentifier];

        let { nonces, commitments } = frost.round1Commit(keyPackage.signing_share);

        noncesMap[participantIdentifier] = nonces;
        commitmentsMap[participantIdentifier] = commitments;
    }

    let signatureShares:any = {};
    let signingPackage = frost.signingPackageNew(commitmentsMap, message);
    for (let participantIdentifier of Object.keys(noncesMap)) {
        let keyPackage = keyPackages[participantIdentifier];

        let nonces = noncesMap[participantIdentifier];

        let signatureShare = frost.round2Sign(signingPackage, nonces, keyPackage);
        signatureShares[participantIdentifier] = signatureShare;
    }

    let aggregtedSignature: string = frost.aggregate(signingPackage, signatureShares, pubkeyPackage);

    return Buffer.from(aggregtedSignature, "hex")
}

export function tweakPubkey(pubkey: string, tweakBy: any): string {
    return frost.pubkeyTweak(pubkey, tweakBy);
}

export function tweakWallet(wallet: {participants: string[], keyPackages: any, pubkeyPackages: any}, tweakBy: string) {
    const keyPackages: any = {};
    const pubkeyPackages: any = {};
    for (let identifier of wallet.participants) {
        keyPackages[identifier] = frost.keyPackageTweak(wallet.keyPackages[identifier], tweakBy);
        pubkeyPackages[identifier] = frost.pubkeyPackageTweak(wallet.pubkeyPackages[identifier], tweakBy)
    }
    return {participants: wallet.participants, keyPackages, pubkeyPackages}
}

export function numToUint256(num: number): string {
    const hex = num.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex').reverse().toString('hex');
}

export function hashStr(str: string): string {
    const data = Buffer.from(str, 'utf-8');
    const hash = sha3_256(data);
    // TODO: replace with curve.mod(num, CURVE_ORDER)
    hash[0] = 0;
    return Buffer.from(hash).reverse().toString('hex');
}