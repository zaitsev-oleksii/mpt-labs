const { createHash } = require("crypto");

const sha256 = (src) => createHash("sha256").update(src).digest("hex");
const sha256d = (src) => {
  const hashed = createHash("sha256").update(src).digest();
  return createHash("sha256").update(hashed).digest("hex");
};
const decToHex = (num, len) => Number(num).toString(16).padStart(len, "0");
const switchEndianness = (hex) => hex.match(/../g).reverse().join("");

const getNonce = (prev) => {
  return prev + Math.ceil(Math.random() * 100);
};

const getMerkleRoot = (txs) => {
  const hashed = txs.map((tx) => sha256d(tx));

  const rec = (hashes) => {
    if (hashes.length === 1) return hashes[0];
    const pairs = hashes.reduce(
      (acc, curr, idx) =>
        !(idx % 2)
          ? [...acc, [curr]]
          : [...acc.slice(0, -1), [...acc[acc.length - 1], curr]],
      []
    );
    return rec(
      pairs.map((leaves) => leaves.join("")).map((merged) => sha256d(merged))
    );
  };

  return rec(hashed);
};

const getTarget = (bits) => {
  const exp = parseInt(bits.substring(0, 2), 16);
  const coef = parseInt(bits.substring(2), 16);
  const target = coef * 2 ** (8 * (exp - 3));
  return decToHex(target, 64);
};

class BlockHeader {
  #defaults = {
    version: 1,
    prevBlockHash: "0".repeat(64),
    bits: "1f00ffff",
    nonce: 0,
    hash: null,
  };
  #block = null;

  constructor(block, { version, prevBlockHash, bits, nonce, hash } = {}) {
    this.version = version ?? this.#defaults.version;
    this.prevBlockHash = prevBlockHash ?? this.#defaults.prevBlockHash;
    this.nonce = nonce ?? this.#defaults.nonce;
    this.bits = bits ?? this.#defaults.bits;
    this.hash = hash ?? this.#defaults.hash;
    this.timestamp = Math.round(Date.now() / 1000);
    this.#block = block;
  }

  get merkleRoot() {
    return getMerkleRoot(this.#block.txs);
  }

  mine() {
    const target = getTarget(this.bits);
    let nonce = this.nonce;
    let iter = 0;
    let found = false;
    while (!found) {
      const concatenated = [
        decToHex(this.version, 8),
        this.prevBlockHash,
        this.merkleRoot,
        decToHex(this.timestamp, 8),
        this.bits,
        decToHex(nonce, 8),
      ]
        .map((hex) => switchEndianness(hex))
        .join("");
      const hashed = switchEndianness(sha256d(concatenated));
      found = parseInt(hashed, 16) < parseInt(target, 16);
      nonce = getNonce(nonce);
      this.nonce = nonce;
      this.hash = hashed;
      iter += 1;
    }
  }

  serialize() {
    const { version, prevBlockHash, nonce, bits, hash, timestamp, merkleRoot } = this;
    return {
      version,
      prevBlockHash,
      nonce,
      bits,
      hash,
      timestamp,
      merkleRoot,
    };
  }
}

class Block {
  constructor({ height = 0, size = 1, txs = [], prevBlockHash, nonce } = {}) {
    this.height = height;
    this.size = size;
    this.txs = txs;
    this.header = new BlockHeader(this, { prevBlockHash, nonce });
  }

  get txCount() {
    return this.txs.length;
  }

  mine() {
    this.header.mine();
  }

  serialize() {
    const { height, size, txs } = this;
    return {
      height,
      size,
      txs,
      header: this.header.serialize(),
    };
  }
}

class BlockChain {
  constructor() {
    this.chain = [new Block({ txs: [`Alex sent 0 coins to Alice`] })];
  }

  addBlock(prevBlockHash) {
    const prevBlock = this.chain.find(
        (block) => block.header.hash === prevBlockHash
    );
    const height = prevBlock.height + 1;
    const block = new Block({
      height,
      prevBlockHash,
      txs: [`Alex sent ${height} coins to Alice`],
    });
    this.chain.push(block);
    return block;
  }

  get genesisBlock() {
    return this.chain[0];
  }

  serialize() {
    return this.chain.map((block) => block.serialize());
  }
}

const run = () => {
  const blockChain = new BlockChain();

  console.log(blockChain.genesisBlock.serialize());
  blockChain.genesisBlock.mine();
  console.log(blockChain.genesisBlock.serialize());

  const block = blockChain.addBlock(blockChain.genesisBlock.header.hash);
  block.mine();

  console.log(blockChain.serialize());
};

run();
