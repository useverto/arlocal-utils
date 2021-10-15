import { JWKInterface } from "arweave/node/lib/wallet";
import { SmartWeaveNodeFactory } from "redstone-smartweave";
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

  /**
   * Copy a contract from Arweave to the ArLocal server
   *
   * @param contractID Arweave contract ID
   * @param useLatestState Wether to use the default state of the contract or start with the current state
   * @param stateModifier A callback to use to modify the contract's state before initializing it
   *
   * @returns New contract ID
   */
  async copyContract(
    contractID: string,
    useLatestState: boolean = false,
    stateModifier?: (state: any) => Promise<any> | any
  ): Promise<string> {
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

    // latest state
    let state: any = undefined;
    const initStateTxID = contractTxTags.find(
      ({ name }) => name.toLowerCase() === "init-state-tx"
    )?.value;

    if (useLatestState) {
      // calculate latest state
      const smartweave = SmartWeaveNodeFactory.memCached(this.arweave);
      const contract = smartweave.contract(contractID);

      state = (await contract.readState()).state;
    } else if (!useLatestState && !!initStateTxID) {
      // handle if the initial state is stored in a different tx
      state = (await axios.get(`${this.gatewayURL}/${initStateTxID}`)).data;
    }

    // run state modifier
    if (!!stateModifier) state = await stateModifier(state);

    // copy the transactions
    const newContractTx = await this.arlocal.createTransaction(
      {
        data:
          (typeof contractTxData === "string" && contractTxData) ||
          JSON.stringify(contractTxData)
      },
      this.wallet
    );
    const newContractSourceTx = await this.arlocal.createTransaction(
      {
        data: contractSourceData
      },
      this.wallet
    );

    for (const tag of contractSourceTags) {
      newContractSourceTx.addTag(tag.name, tag.value);
    }

    await this.arlocal.transactions.sign(newContractSourceTx, this.wallet);

    const uploader2 = await this.arlocal.transactions.getUploader(
      newContractSourceTx
    );

    while (!uploader2.isComplete) {
      await uploader2.uploadChunk();
    }

    const stateInTags = !!contractTxTags.find(
      ({ name }) => name.toLowerCase() === "init-state"
    );
    let setSrc = false;

    for (const tag of contractTxTags) {
      // overwrite init-state with the latest state, if the tag exits
      if (tag.name.toLowerCase() === "init-state" && state && useLatestState) {
        newContractTx.addTag(tag.name, JSON.stringify(state));
        continue;
      }

      // if the contract uses a tx to initialize it's state, overwrite that
      if (tag.name.toLowerCase() === "init-state-tx") {
        if (!stateInTags)
          newContractTx.addTag("Init-State", JSON.stringify(state));

        continue;
      }

      if (tag.name.toLowerCase() === "contract-src") {
        newContractTx.addTag(tag.name, newContractSourceTx.id);
        setSrc = true;
        continue;
      }

      newContractTx.addTag(tag.name, tag.value);
    }

    if (!setSrc) newContractTx.addTag("Contract-Src", newContractSourceTx.id);

    await this.arlocal.transactions.sign(newContractTx, this.wallet);

    const uploader1 = await this.arlocal.transactions.getUploader(
      newContractTx
    );

    while (!uploader1.isComplete) {
      await uploader1.uploadChunk();
    }

    // mine txs
    await this.mine();

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

    // mine tx
    await this.mine();

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

  private async mine() {
    await this.arlocal.api.get("mine");
  }
}
