import { JWKInterface } from "arweave/node/lib/wallet";
import { createContract } from "smartweave";
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
   * @param arweaveClient Arweave client connected to a public ("mainnet") arweave gateway
   */
  constructor(
    localClient: Arweave,
    arweaveWallet: JWKInterface,
    arweaveClient?: Arweave
  ) {
    this.arlocal = localClient;
    this.wallet = arweaveWallet;
    if (arweaveClient) this.arweave = arweaveClient;

    const { host, protocol } = this.arweave.getConfig().api;
    this.gatewayURL = protocol + "://" + host;
  }

  // TODO: support copying contracts' current state

  /**
   * Copy a contract from Arweave to the ArLocal server
   *
   * @param contractID Arweave contract ID
   *
   * @returns New contract ID
   */
  async copyContract(contractID: string): Promise<string> {
    this.validateHash(contractID);

    const contractTx = await this.arweave.transactions.get(contractID);
    // @ts-ignore
    const contractTags = contractTx.get("tags").map((tag) => ({
      name: tag.get("name", { decode: true, string: true }),
      value: tag.get("value", { decode: true, string: true })
    }));
    let initState = contractTags.find(
      ({ name }) => name === "Init-State"
    )?.value;

    if (!initState)
      initState = (await axios.get(`${this.gatewayURL}/${contractID}`)).data;

    const { data: contractSource } = await axios.get(
      `${this.gatewayURL}/${
        contractTags.find(({ name }) => name === "Contract-Src").value
      }`
    );

    const id = await createContract(
      this.arlocal,
      this.wallet,
      contractSource,
      typeof initState === "string"
        ? initState
        : JSON.stringify(initState, undefined, 2)
    );

    return id;
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
}
