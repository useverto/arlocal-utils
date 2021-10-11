# arlocal-utils

`arlocal-utils` is a small utility package that helps creating tests for [SmartWeave](https://github.com/ArweaveTeam/SmartWeave) contracts with [ArLocal](https://github.com/textury/arlocal). The library enables developers to easily copy transactions and contracts from any Arweave gateway to an ArLocal testing gateway.

## Install

```sh
yarn add arlocal-utils
```

or

```sh
npm i arlocal-utils
```

## Usage

```ts
import ArLocalUtils from "arlocal-utils";

// create an Arweave client for the ArLocal gateway
const arlocalClient = new Arweave({
  host: "localhost",
  port: 123,
  protocol: "http"
});

// generate a wallet on the ArLocal gateway
// it will be used later to copy txs & contracts
const wallet = await arlocalClient.wallets.generate();

// initialize the library with the ArLocal Arweave client
const arlocalUtils = new ArLocalUtils(arlocalClient, wallet);
```

## Copy transactions

To copy a transaction with it's data / tags from an Arweave gateway, use this code:

```ts
// returns the new ID for the copied transaction
const id = await arlocalUtils.copyTransaction(
  "FGz4VCxU8_jsLeRth4aaJ586tcwgy96ot-3qD5wAFqw"
);
```

## Copy contracts

To copy a contract from an Arweave gateway, use this code:

```ts
// returns the new contract ID for the copied contract
const id = await arlocalUtils.copyContract(
  "usjm4PCxUd5mtaon7zc97-dt-3qf67yPyqgzLnLqk5A"
);
```

## Get some example PSTs

If your tests need some example PSTs to operate with, the following code will return 4 IDs for PST contracts that you can use:

```ts
// returns an array of 4 PST contract IDs
const psts = await arlocalUtils.examplePSTs();
```
