import { JWKInterface } from "arweave/node/lib/wallet";
import { createContract } from "smartweave";
import Transaction from "arweave/node/lib/transaction";
import axios from "axios";
import Arweave from "arweave";

const defaultClient = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https"
});

type PSTContractsType = [string, string, string, string];

export default class ArLocalUtils {
  public arweave = defaultClient;
  public arlocal: Arweave;

  private psts: PSTContractsType;
  private wallet: JWKInterface;
  private gatewayURL: string;

  /**
   *
   * @param localClient Arweave client connected to ArLocal
   * @param localWallet A local wallet generated on the same ArLocal server
   * @param arweaveClient Arweave client connected to a public ("mainnet") arweave gateway
   */
  constructor(
    localClient: Arweave,
    localWallet: JWKInterface,
    arweaveClient?: Arweave
  ) {
    this.arlocal = localClient;
    this.wallet = localWallet;
    if (arweaveClient) this.arweave = arweaveClient;

    const { host, protocol } = this.arweave.getConfig().api;
    this.gatewayURL = protocol + "://" + host;
  }

  // TODO: support optionally copying contracts' current state

  /**
   * Copy a contract from Arweave to the ArLocal server
   *
   * @param contractID Arweave contract ID
   *
   * @returns New contract ID
   */
  async copyContract(contractID: string): Promise<string> {
    this.validateHash(contractID);

    // get contract init transaction data
    const contractTx = await this.arweave.transactions.get(contractID);
    const contractTxTags = this.mapTags(contractTx);
    const { data: contractTxData } = await axios.get(
      `${this.gatewayURL}/${contractID}`
    );

    // get contract source data
    const contractSourceID = contractTxTags.find(
      ({ name }) => name === "Contract-Src"
    ).value;
    const contractSourceTx = await this.arweave.transactions.get(
      contractSourceID
    );
    const contractSourceTags = this.mapTags(contractSourceTx);
    const { data: contractSourceData } = await axios.get(
      `${this.gatewayURL}/${contractSourceID}`
    );

    // copy the transactions
    const newContractTx = await this.arlocal.createTransaction(
      {
        data: contractTxData
      },
      this.wallet
    );
    const newContractSourceTx = await this.arlocal.createTransaction(
      {
        data: contractSourceData
      },
      this.wallet
    );

    for (const tag of contractTxTags) {
      newContractTx.addTag(tag.name, tag.value);
    }

    for (const tag of contractSourceTags) {
      newContractSourceTx.addTag(tag.name, tag.value);
    }

    await this.arlocal.transactions.sign(newContractTx, this.wallet);
    await this.arlocal.transactions.sign(newContractSourceTx, this.wallet);

    const uploader1 = await this.arlocal.transactions.getUploader(
      newContractTx
    );

    while (!uploader1.isComplete) {
      await uploader1.uploadChunk();
    }

    const uploader2 = await this.arlocal.transactions.getUploader(
      newContractSourceTx
    );

    while (!uploader2.isComplete) {
      await uploader2.uploadChunk();
    }

    return newContractTx.id;
  }

  /**
   * Copy a transaction from Arweave (with tags and data) to the ArLocal server
   *
   * @param txID ID of the transaction to copy
   * @returns New transaction ID
   */
  async copyTransaction(txID: string): Promise<string> {
    this.validateHash(txID);

    let data = "SAMPLE_DATA";
    const oldTx = await this.arweave.transactions.get(txID);

    try {
      data = (await axios.get(`${this.gatewayURL}/${txID}`, { timeout: 10000 }))
        .data;
    } catch {}

    const transaction = await this.arlocal.createTransaction(
      {
        data
      },
      this.wallet
    );

    // @ts-ignore
    oldTx.get("tags").forEach((tag) => {
      transaction.addTag(
        tag.get("name", { decode: true, string: true }),
        tag.get("value", { decode: true, string: true })
      );
    });

    await this.arlocal.transactions.sign(transaction, this.wallet);

    const uploader = await this.arlocal.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
    }

    return transaction.id;
  }

  /**
   * Get example PST contracts
   *
   * @returns 4 PST contract IDs
   */
  async examplePSTs(): Promise<PSTContractsType> {
    if (this.psts) return this.psts;

    return [
      await this.copyContract("usjm4PCxUd5mtaon7zc97-dt-3qf67yPyqgzLnLqk5A"),
      await this.copyContract("-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ"),
      await this.copyContract("f6lW-sKxsc340p8eBBL2i_fnmSI_fRSFmkqvzqyUsRs"),
      await this.copyContract("mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74")
    ];
  }

  private validateHash(hash: string) {
    if (!/[a-z0-9_-]{43}/i.test(hash))
      throw new Error("Invalid hash: not an Arweave format");
  }

  private mapTags(tx: Transaction): { name: string; value: string }[] {
    // @ts-ignore
    return tx.get("tags").map((tag) => ({
      name: tag.get("name", { decode: true, string: true }),
      value: tag.get("value", { decode: true, string: true })
    }));
  }
}
