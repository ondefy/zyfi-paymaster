# Zyfi Paymaster

Paymaster implementation for [Zyfi](https://zyfi.org/).

It supports any ERC-20 token, and can easily be integrated using an [API](https://docs.zyfi.org/).

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

## Project structure

- `/contracts`: smart contracts.
- `/deploy`: deployment and contract interaction scripts.
- `/test`: test files
- `hardhat.config.ts`: configuration file.

## Commands

- `yarn hardhat compile` will compile the contracts.
- `yarn local-node` will run the in-memory node
- `yarn test` will run tests. **Check test requirements below.**

Both `yarn run deploy` and `yarn run greet` are configured in the `package.json` file and run `yarn hardhat deploy-zksync`.

### Environment variables

In order to prevent users to leak private keys, this project includes the `dotenv` package which is used to load environment variables. It's used to load the wallet private key, required to run the deploy script.

To use it, rename `.env.example` to `.env` and enter your private key.

```
WALLET_PRIVATE_KEY=123cde574ccff....
```

### Local testing

In order to run test, you need to start the zkSync local environment. This project uses the [in-memory node](https://era.zksync.io/docs/tools/testing/era-test-node.html#configuring-tests) as it's only on L2.
Begin by installing era-test-node using the command:

```
cargo install --git https://github.com/matter-labs/era-test-node.git --locked
```

Rust should install it in the ~/.cargo/bin directory.

To start the node, execute:

```
yarn local-node
```

P
lease check [this section of the docs](https://v2-docs.zksync.io/api/hardhat/testing.html#prerequisites) which contains all the details.

If you do not start the zkSync local environment, the tests will fail with error `Error: could not detect network (event="noNetwork", code=NETWORK_ERROR, version=providers/5.7.2)`

## Official Links

- [Website](https://zksync.io/)
- [Documentation](https://v2-docs.zksync.io/dev/)
- [GitHub](https://github.com/matter-labs)
- [Twitter](https://twitter.com/zksync)
- [Discord](https://discord.gg/nMaPGrDDwk)
