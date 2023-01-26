import React, { useState, useCallback, useEffect } from "react"
import Web3 from "web3"
import {
  Store,
  ReactNotifications,
  NOTIFICATION_TYPE,
} from "react-notifications-component"
import "react-notifications-component/dist/theme.css"
import { recoverTypedSignature_v4 } from "eth-sig-util"
import config from "./config"

const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "salt", type: "bytes32" },
  { name: "verifyingContract", type: "address" },
]

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" },
]

let domainData: { [key: string]: any } = {
  name: "TestContract",
  version: "1",
  verifyingContract: config.contract.address,
}

let web3: any = null
let contract: any = null

function App() {
  const [selectedAddress, setSelectedAddress] = useState<string>(
    "0x0000000000000000000000000000000000000000"
  )
  const [quote, setQuote] = useState<string>("Default quote")
  const [owner, setOwner] = useState<string>("Default owner")
  const [newQuote, setNewQuote] = useState<string>("")

  const getQuoteFromNetwork = useCallback(() => {
    if (web3 && contract) {
      contract.methods
        .getQuote()
        .call()
        .then((result: any) => {
          console.info(`QuoteFromNetwork ${JSON.stringify(result)}`)
          if (
            result &&
            result.currentQuote !== undefined &&
            result.currentOwner !== undefined
          ) {
            if (result.currentQuote === "") {
              showNotification("warning", "No quotes set on blockchain yet")
            } else {
              setQuote(result.currentQuote)
              setOwner(result.currentOwner)
            }
          } else {
            showNotification("danger", "Not able to get quote information from Network")
          }
        })
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== "undefined" && window.ethereum.isMetaMask) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        })
        const provider = window.ethereum
        if (provider.networkVersion === "5") {
          domainData.salt =
            "0x0000000000000000000000000000000000000000000000000000000000000005"
          web3 = new Web3(provider)

          contract = new web3.eth.Contract(
            config.contract.abi as any[],
            config.contract.address
          )

          getQuoteFromNetwork()
          setSelectedAddress(accounts[0])
          provider.on("accountsChanged", (accounts: string[]) =>
            setSelectedAddress(accounts[0])
          )
        } else {
          showNotification("warning", "Please change the network in metamask to Goerli")
        }
      } else {
        showNotification("danger", "Metamask not installed")
      }
    }

    init()
  }, [getQuoteFromNetwork])

  const onQuoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewQuote(event.target.value)
  }

  const onSubmit = async () => {
    console.log(contract)
    if (newQuote !== "" && contract) {
      console.log("Sending meta transaction...")
      let userAddress = selectedAddress
      let nonce = await contract.methods.getNonce(userAddress).call()
      let functionSignature = contract.methods.setQuote(newQuote).encodeABI()
      let message = {
        nonce,
        from: userAddress,
        functionSignature,
      }

      const dataToSign = JSON.stringify({
        types: {
          EIP712Domain: domainType,
          MetaTransaction: metaTransactionType,
        },
        primaryType: "MetaTransaction",
        domain: domainData,
        message,
      })
      console.log(`DomainData ${JSON.stringify(domainData)}`)
      console.log()

      // web3.currentProvider.send({ jsonrpc: "2.0", id: 999999999999 , method: "eth_signTypedData_v4", params: [userAddress, dataToSign]},
      // (error: string, response: any) => {
      // })
      const response = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [userAddress, dataToSign],
      })
      console.log(`User signature is ${response}`)
      if (!response) {
        showNotification("danger", "Could not get user signature")
      } else {
        let { r, s, v } = getSignatureParameters(response)
        console.log(`UserAddress ${userAddress}`)
        console.log(`Message ${JSON.stringify(message)}`)
        console.log({ r, s, v })

        const recovered = recoverTypedSignature_v4({
          data: JSON.parse(dataToSign),
          sig: response,
        })
        console.log(`Recovered ${recovered}`)
        sendTransaction(userAddress, functionSignature, r, s, v)
      }
      // console.log("Sending normal transaction")
      // contract.methods
      //   .setQuote(newQuote)
      //   .send({ from: selectedAddress })
      //   .on("transactionHash", (hash: string) => {
      //     showNotification("info", `Transaction sent to blockchain with hash ${hash}`)
      //   })
      //   .once("confirmation", function (confirmationNumber: number, _: any) {
      //     showNotification("success", "Transaction confirmed")
      //     getQuoteFromNetwork()
      //   })
    } else {
      showNotification("warning", "Please enter the quote")
    }
  }

  const getSignatureParameters = (signature: string) => {
    if (!web3.utils.isHexStrict(signature)) {
      throw new Error('Given value "'.concat(signature, '" is not a valid hex string.'))
    }
    var r = signature.slice(0, 66)
    var s = "0x".concat(signature.slice(66, 130))
    var v = "0x".concat(signature.slice(130, 132))
    if (![27, 28].includes(web3.utils.hexToNumber(v)))
      v = (web3.utils.hexToNumber(v) + 27).toString()
    return {
      r: r,
      s: s,
      v: v,
    }
  }

  const showNotification = (type: NOTIFICATION_TYPE, message: string) => {
    const titleTypes = {
      warning: "Warning",
      success: "Success!",
      info: "Info",
      danger: "Error",
      default: "Alert",
    }
    Store.addNotification({
      type,
      message,
      title: titleTypes[type],
      insert: "top",
      container: "top-right",
      animationIn: ["animate__animated", "animate__fadeIn"],
      animationOut: ["animate__animated", "animate__fadeOut"],
      dismiss: {
        duration: 5000,
        onScreen: true,
      },
    })
  }

  const sendTransaction = async (
    userAddress: string,
    functionData: string,
    r: string,
    s: string,
    v: string
  ) => {
    if (web3 && contract) {
      try {
        let gasLimit = await contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .estimateGas({ from: userAddress })
        let gasPrice = await web3.eth.getGasPrice()
        console.log(gasLimit)
        console.log(gasPrice)
        let tx = contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .send({
            from: userAddress,
            gasPrice: web3.utils.toHex(gasPrice),
            gasLimit: web3.utils.toHex(gasLimit),
          })

        tx.on("transactionHash", (hash: string) => {
          console.log(`Transaction hash is ${hash}`)
          showNotification("info", `Transaction sent by relayer with hash ${hash}`)
        }).once("confirmation", (confirmationNumber: number, receipt: any) => {
          console.log(receipt)
          showNotification("success", "Transaction confirmed on chain")
          getQuoteFromNetwork()
        })
      } catch (error: any) {
        showNotification("danger", error.message)
      }
    }
  }

  return (
    <div>
      <div>
        <blockquote>
          <p>{quote}</p>
          <p>{owner}</p>
        </blockquote>
      </div>
      <input type="text" value={newQuote} onChange={onQuoteChange} />
      <button onClick={onSubmit}>Submit</button>
      <ReactNotifications />
    </div>
  )
}

export default App
