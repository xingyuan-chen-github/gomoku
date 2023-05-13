const hardhat = require('hardhat')

async function main() {
  const Gomoku = await hardhat.ethers.getContractFactory('Gomoku')
  const gomoku = await Gomoku.deploy()

  await gomoku.deployed()
  console.log('Contract deployed to:', gomoku.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})