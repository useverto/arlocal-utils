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

  /**
   *
   * @param localClient Arweave client connected to ArLocal
   * @param arweaveClient Arweave client connected to a public ("mainnet") arweave gateway
   */
  constructor(localClient: Arweave, arweaveClient?: Arweave) {
    this.arlocal = localClient;
    if (arweaveClient) this.arweave = arweaveClient;
  }

  /**
   * Copy a contract from Arweave to the ArLocal server
   *
   * @param contractID Arweave contract ID
   *
   * @returns New contract ID
   */
  async copyContract(contractID: string): Promise<string> {
    return "";
  }

  /**
   * Copy a transaction from Arweave (with tags and data) to the ArLocal server
   *
   * @param txID
   * @returns New transaction ID
   */
  async copyTransaction(txID: string): Promise<string> {
    return "";
  }

  /**
   * Get example PST contracts
   *
   * @returns 4 PST contract IDs
   */
  async examplePSTs(): Promise<PSTContractsType> {
    if (this.psts) return this.psts;

    return ["", "", "", ""];
  }
}
