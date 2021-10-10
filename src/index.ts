import { JWKInterface } from "arweave/node/lib/wallet";
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

  /**
   *
   * @param localClient Arweave client connected to ArLocal
   * @param arweaveClient Arweave client connected to a public ("mainnet") arweave gateway
   */
  constructor(
    localClient: Arweave,
    arweaveClient?: Arweave,
    arweaveWallet?: JWKInterface
  ) {
    this.arlocal = localClient;
    if (arweaveClient) this.arweave = arweaveClient;
    if (arweaveWallet) this.wallet = arweaveWallet;
  }

  /**
   * Copy a contract from Arweave to the ArLocal server
   *
   * @param contractID Arweave contract ID
   *
   * @returns New contract ID
   */
  async copyContract(contractID: string): Promise<string> {
    await this.makeWallet();
    return "";
  }

  /**
   * Copy a transaction from Arweave (with tags and data) to the ArLocal server
   *
   * @param txID ID of the transaction to copy
   * @returns New transaction ID
   */
  async copyTransaction(txID: string): Promise<string> {
    await this.makeWallet();

    const transaction = await this.arweave.transactions.get(txID);

    await this.arweave.transactions.sign(transaction, this.wallet);

    const uploader = await this.arweave.transactions.getUploader(transaction);

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
    await this.makeWallet();
    if (this.psts) return this.psts;

    return ["", "", "", ""];
  }

  private async makeWallet() {
    if (this.wallet) return;
    this.wallet = await this.arweave.wallets.generate();
  }
}
