import { useState, useCallback, useEffect } from 'react'
import './Cleaner.css'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { useWalletNfts } from '@nfteyez/sol-rayz-react'
import { Grid, Button } from '@material-ui/core'
import Alert from '@mui/material/Alert';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import * as spltoken from "@solana/spl-token";
import CircularProgress from '@mui/material/CircularProgress';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import rabbitFilter from '../filter.json'
import refresh from '../images/refresh.png'


const Cleaner = () => {

  //set up user wallet for use in dapp
  const wallet = useAnchorWallet()
  let walletAddress = wallet?.publicKey.toString()

  //set up solana connection with RPC and "confirmed" committment
  const connection = new Connection("https://bold-old-moon.solana-mainnet.quiknode.pro/ce6fe5d59cabd95814a4c61a6e69afbbfc625c9f/", "confirmed");

  //set up state and hooks
  const { publicKey, sendTransaction } = useWallet();  //custom Solana hook for getting wallet publickey and sending transaction
  const [tokens, setTokens] = useState([]) //state variable for fungible tokens
  const [isNFTS, setIsNFTS] = useState() //state variable for displaying nfts
  const [isTokens, setIsTokens] = useState() //state variable to displaying fungible tokens
  const [tabClicked, setTabClicked] = useState('') //state variable for which tab is clicked
  const [tx, setTx] = useState('') //state variable for transaction hash post confirmation
  const [isLoading, setIsLoading] = useState(false) //state variable for waiting on closing token accounts transaction confirmation
  const [isBurnLoading, setIsBurnLoading] = useState(false) //state variable for waiting on burning tokens transaction confirmation
  const [metadata, setMetadata] = useState({}); //state variable for holding metadata info
  const [empty, setEmpty] = useState([])  //state variable for which token accounts in wallet are empty
  const [nftsSelected, setNftsSelected] = useState([])  //state variable for which nfts have been selected by user
  const [tokensSelected, setTokensSelected] = useState([]) //state variable for which fungible tokens have been selected by user

  //fetch nfts from wallet
  const { nfts } = useWalletNfts({
    publicAddress: walletAddress

  })

  //fectch metadata for nfts from wallet
  const fetchMetadata = useCallback(async () => {
    for (const nft of nfts) {
      try {
        fetch(nft.data.uri)
          .then((response) => response.json())
          .then((meta) =>
            setMetadata((state) => ({ ...state, [nft.mint]: meta }))
          );
      } catch (error) {
        console.log(error)
      }

    }
  }, [nfts]);

  useEffect(() => {
    if (nfts?.length) fetchMetadata();
  }, [nfts, fetchMetadata]);


  //get all wallet tokens and filter for Fungible Tokens.  First get all tokens from wallet.  
  //Then filter for empty accounts and tokens with an amount over 1 (this is the current filter for fungible vs nfts, a better one is needed)
  useEffect(() => {
    const fetchTokens = async () => {
      //get tokens from wallet
      let response = await connection.getParsedTokenAccountsByOwner(wallet?.publicKey, {
        programId: spltoken.TOKEN_PROGRAM_ID,
      });

      //initialize variables to hold the tokens and empty accounts after filtering.
      let token = []
      let emptyAccounts = []
      //begin filter for empty
      response.value.forEach((accountInfo, index) => {
        if (parseInt(accountInfo.account.data["parsed"]["info"]["tokenAmount"]["amount"]) === 0) {
          emptyAccounts.push(accountInfo)
          setEmpty([...emptyAccounts])
        }
        //filter for tokens with amount over 1 (ft vs nft filter)
        if (parseInt(accountInfo.account.data["parsed"]["info"]["tokenAmount"]["amount"]) > 1) {

          token.push(accountInfo)
          setTokens([...token])
        }
      })

    };
    fetchTokens()
      .catch(console.error)
  }, [metadata])

  //Set up filter for wallets containing Bobby Rabbits nfts utilizing hashlist.
  const getMints = JSON.stringify(nfts)

  var arr = []
  try {
    arr = JSON.parse(getMints).reduce((acc, val) => [...acc, val.mint], [])
  } catch (e) {
    console.log("Invalid json")
  }
  const checkTokens = rabbitFilter.some((r) => arr.indexOf(r) >= 0)

  //function for NFTs tab switching
  const onNFTClick = () => {
    setTabClicked('false')
    setIsNFTS(!isNFTS)
    setIsTokens(false)
  }

  //function for Tokens tab switching
  const onTokensClick = () => {
    setIsNFTS(false)
    setIsTokens(!isTokens)
    setTabClicked('true')
  }

  //Selecter for NFTs Function
  const onEachNFTClick = (e, index) => {
    setNftsSelected(nftsSelected => nftsSelected.includes(nfts[index].mint) ? nftsSelected.filter(n => n !== nftsSelected[nftsSelected.indexOf(nfts[index].mint)]) : [...nftsSelected, nfts[index].mint])
  }

  //Selector for Tokens Function
  const onEachTokenClick = (e, index) => {
    setTokensSelected(tokensSelected => tokensSelected.includes(tokens[index].account.data['parsed']['info']['mint']) ? tokensSelected.filter(n => n !== tokensSelected[tokensSelected.indexOf(tokens[index].account.data['parsed']['info']['mint'])]) : [...tokensSelected, tokens[index].account.data['parsed']['info']['mint']])
  }

  //close empty accounts
  const onCloseClick = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();
    //initialize loading animation
    setIsLoading(true)
    //define and initialize instructions variable to build custom instructions
    let instructions = []
    //define the sender wallet
    const fromWallet = wallet
    //define wallet accepting fees.
    const feeWallet = new PublicKey('63CgiXpqYeziY9swqNw3oTuQy1TuNhcykGUy99q8X816')

    //create fee schedule depending on amount closed/burned and if user holds a Bobby Rabbit
    let fee = 0
    if (checkTokens === true) {
      fee = 0
    } else {
      fee = 1_000_000 * empty.length
    }
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: feeWallet,
        lamports: fee,
      })
    )

    //build instructions for closing empty token accounts
    for (let i = 0; i < empty.length; i++) {
      let tokenAccountPub = new PublicKey(empty[i].pubkey.toBase58())
      instructions.push(
        spltoken.createCloseAccountInstruction(
          tokenAccountPub,
          fromWallet.publicKey,
          fromWallet.publicKey
        )
      )
    }
    //send and confirm transaction
    try {
      const transaction = new Transaction().add(...instructions)
      const signature = await sendTransaction(transaction, connection);
      const latestBlockHash = await connection.getLatestBlockhash();

      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: signature,
      });
      setTx(signature)
      console.log(signature)
      setIsLoading(false)

    } catch (error) {
      setTx('false')
      console.error(error);
      setIsLoading(false)
    }
  })

  //burning mechanism function
  const onBurnClick = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();
    //initialize loading animation
    setIsBurnLoading(true)
    //define and initialize instructions variable to build custom instructions
    let instructions = []
    //define the sender wallet
    const fromWallet = wallet
    //define wallet accepting fees.
    const feeWallet = new PublicKey('63CgiXpqYeziY9swqNw3oTuQy1TuNhcykGUy99q8X816')

    //check whether user is burning nfts or tokens
    if (isNFTS && !isTokens) {
      //create fee schedule depending on amount closed/burned and if user holds a Bobby Rabbit
      let fee = 0
      if (checkTokens === true) {
        fee = 0
      } else {
        fee = 1_000_000 * nftsSelected.length
      }
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: feeWallet,
          lamports: fee,
        })
      )
      //build instructions for selected nfts to burn
      for (let i = 0; i < nftsSelected.length; i++) {
        let nftMint = new PublicKey(nftsSelected[i])
        let nftAccount = await connection.getParsedTokenAccountsByOwner(fromWallet.publicKey, { mint: nftMint, })
        instructions.push(
          spltoken.createBurnCheckedInstruction(
            nftAccount.value[0].pubkey,
            nftMint,
            fromWallet.publicKey,
            1,
            0,
            [],
            spltoken.TOKEN_PROGRAM_ID
          )
        )
      }
    } else if (!isNFTS && isTokens) {

      let fee = 0
      if (checkTokens === true) {
        fee = 0
      } else {
        fee = 1_000_000 * tokensSelected.length
      }
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: feeWallet,
          lamports: fee,
        })
      )
      //build instructions for selected tokens to burn
      for (let i = 0; i < tokensSelected.length; i++) {
        let tokenMint = new PublicKey(tokensSelected[i])
        let selectedTokenAccount = await connection.getParsedTokenAccountsByOwner(fromWallet.publicKey, { mint: tokenMint, })
        let amountToBurn = parseInt(selectedTokenAccount.value[0].account.data['parsed']['info']['tokenAmount']['amount'])
        let tokenDecimalAmount = selectedTokenAccount.value[0].account.data['parsed']['info']['tokenAmount']['decimals']

        instructions.push(
          spltoken.createBurnCheckedInstruction(
            selectedTokenAccount.value[0].pubkey,
            tokenMint,
            fromWallet.publicKey,
            amountToBurn,
            tokenDecimalAmount,
            [],
            spltoken.TOKEN_PROGRAM_ID
          )
        )
      }
    }
    //send and confirm burn transaction
    try {
      const transaction = new Transaction().add(...instructions)
      const signature = await sendTransaction(transaction, connection);
      const latestBlockHash = await connection.getLatestBlockhash();

      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: signature,
      });
      setTx(signature)
      console.log(signature)
      setIsBurnLoading(false)
    } catch (error) {
      setTx('false')
      console.error(error);
      setIsBurnLoading(false)
    }
  })

  let isTooMuch //define variable for too many tokens selected
  let tokensOrNfts //define variable for showing "please select nfts or tokens"

  //check to determine if nfts or tokens are showing or not
  if (((isTokens === undefined) && (isNFTS === undefined)) || (!isTokens && !isNFTS)) {
    tokensOrNfts = true
  } else {
    tokensOrNfts = false
  }
  //check to make sure 10 or less tokens or nfts are selected
  if (tokensSelected.length > 10 || nftsSelected.length > 10) {
    isTooMuch = true
  } else {
    isTooMuch = false
  }
  //function to refresh page after transaction (user choice)
  const refreshPage = () => {
    window.location.reload();
  }
  return (
    <div className='CleanerMain'>
      <h1 className='CleanerTitle'>Wallet Cleaner</h1>
      <h3 className='CleanerDescription'>Burn and Close Token Accounts</h3>
      <h5 className='warning'>*Please exercise caution when burning any tokens or nfts.  Use at your own risk as this is unaudited technology.  We will not be held liable for any fees charged or accidental token burning*</h5>
      <div className='CleanerContainer'>
        {wallet?.publicKey ? (
          <div className='tokens'>
            <div className='Tabs'>
              {(tabClicked === 'true') ? (<><Button className='NFTS' onClick={onNFTClick}> NFTs</Button>
                <Button className='TokensClicked' onClick={onTokensClick}>Tokens</Button></>) : (tabClicked === 'false') ?

                (<><Button className='NFTSClicked' onClick={onNFTClick}> NFTs</Button>
                  <Button className='Tokens' onClick={onTokensClick}>Tokens</Button></>) :

                (<><Button className='NFTS' onClick={onNFTClick}> NFTs</Button>
                  <Button className='Tokens' onClick={onTokensClick}>Tokens</Button></>)
              }
            </div>
            <div className='allTokens'>
              {tokensOrNfts && <div className='tokensORnfts'><h1 className='choice'>Please Select Tokens or NFTs</h1></div>}
              {(isNFTS && !isTokens) ?
                (<div className='mappedNFTS'>
                  <Grid
                    container
                    spacing={1}
                  >
                    {nfts.map((nft, index) => {
                      return (
                        <Grid item key={index} md={4} lg={3}>
                          <div className='eachNFT' onClick={(e) => onEachNFTClick(e, index)} > {nftsSelected.includes(nfts[index].mint) &&
                            <div className='eachNFTClicked'><h1 className='selectedText'>Selected</h1></div>}
                            <img src={metadata?.[nft.mint]?.image} className='nftImage' alt="loading" />
                            <br />
                            <p className='nftTitles'>{nft.data.name}</p>

                          </div>
                        </Grid>
                      )
                    })}
                  </Grid>
                </div>)
                :
                (!isNFTS && isTokens) ?

                  (<div className='mappedTokens'>{!isTooMuch ? (<h3 className='Limit'> Max 10 at a time</h3>) : (<h3 className='Limit'>Too Many Selected</h3>)}
                    {tokens.map((token, index) => {
                      return (<div className='eachToken' key={index} onClick={(e) => onEachTokenClick(e, index)}> {tokensSelected.includes(tokens[index].account.data['parsed']['info']['mint']) &&
                        <div className='eachTokenClicked'><h1 className='selectedText'>Selected</h1></div>}
                        <h4 className='tokenNames'>Token:</h4> <h4 className='tokenAddress'>{token.account.data['parsed']['info']['mint']}</h4>
                        <div style={{ display: 'flex' }}> Balance:
                          <div style={{ padding: '2px', backgroundColor: 'white', marginLeft: '4px', borderRadius: '5px' }}><h5 style={{ color: "black", marginTop: '0', marginBottom: '0' }}>{token.account.data['parsed']['info']['tokenAmount']['uiAmount']}</h5></div>
                        </div>
                      </div>)
                    })}
                  </div>) :
                  (<div></div>)
              }
            </div>
          </div>) :
          (
            <div style={{ display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
              <h3> Please Connect Wallet</h3>
              <WalletMultiButton /></div>
          )}
        <div className='purchase'>
          <h1 className='howto'>How To</h1>
          <h4 style={{ color: 'red' }}>*Collection NFTs show as Tokens, so beware of which tokens you burn*</h4>
          <h4 className='step'>1. Use the button "Close Empty Accounts" to close all empty token accounts and redeem your rent fees.</h4>
          <h4 className='step'>2. To burn, choose NFTs or Tokens on tabs (limit of 10 at a time)</h4>
          <h4 className='step'>3. Select which NFTs/Tokens you want to burn by clicking on them</h4>
          <h4 className='step'>4. Click the Burn Button and Approve Transaction!</h4>
          <div className='Buttons'>
            <h5 className='Fees'>A fee of .001 is applied for each NFT or Token burned.  This service is free for Bobby Rabbits Holders</h5>
            {!isLoading ? (<Button className='closeAccounts' variant='contained' onClick={onCloseClick} disabled={!publicKey}>Close Empty Accounts ({empty.length})</Button>) :
              (<Button className='closeAccounts' variant='contained'><CircularProgress /></Button>)}
            {!isBurnLoading ? (<Button className='burn' variant='contained' onClick={onBurnClick} disabled={!publicKey || isTooMuch}>Burn Tokens {(!isNFTS && isTokens) ? (<span> ({tokensSelected.length})</span>) : (isNFTS && !isTokens) ? (<span> ({nftsSelected.length})</span>) : (<span></span>)}</Button>) :
              (<Button className='burn' variant='contained'><CircularProgress /></Button>)}
            <br></br> <Button className='refresh' variant='contained' onClick={refreshPage}>Refresh<img className='refreshIcon' src={refresh} alt='refresh' /></Button>
            {tx.length > 6 ?
              (<Alert severity="success">
                Success - Transaction success <strong><a href={'https://solscan.io/tx/' + tx} target='_blank' rel='noreferrer'>Check Tx on Solscan</a></strong>
              </Alert>) : tx === 'false' ?
                (<Alert severity="error">
                  Error - Transaction was not confirmed-<strong>Please check wallet and try again</strong>
                </Alert>) : (<div></div>)
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cleaner