const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const ETH_RPC='https://cloudflare-eth.com';
const BLOCKSCOUT='https://eth.blockscout.com/api/v2';
const ETH_EXPLORER='https://eth.blockscout.com';
const airdrops=[['ZKDROP','Ethereum / ZK','Snapshot: Oct 12','HOT'],['HOODNET','Robinhood Chain','Tasks active','LIVE'],['ARCX','Arc','Claim: Oct 19','HOT'],['SOLVAULT','Solana','Season 2 farming','LIVE'],['BASEBOX','Base','Eligibility open','LIVE'],['VOID404','EVM','Coming soon','SOON']];
const testnets=[['Robinhood Chain','5 tasks','ACTIVE'],['Arc Testnet','3 tasks','ACTIVE'],['Base Sepolia','7 tasks','ACTIVE'],['Monad Testnet','4 tasks','ACTIVE'],['Sui Testnet','2 tasks','ACTIVE']];
const quests=[['Daily Wallet Check','Connect wallet + verify activity','+10 XP'],['Testnet Runner','Complete 3 testnet interactions','+50 XP'],['Airdrop Hunter','Track 5 campaigns','+25 XP'],['Contract Detective','Scan a contract','+15 XP'],['NFT Collector','Hold or mint an NFT','+20 XP']];
const calendar=[['OCT 02','HOODNET','Quest checkpoint'],['OCT 05','ZKDROP','Eligibility update'],['OCT 12','ZKDROP','Snapshot'],['OCT 19','ARCX','Claim window'],['OCT 24','SOLVAULT','Season closes']];
let provider=null, signer=null, currentAddress=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function render(){
 $('#airdropCards').innerHTML=airdrops.map(x=>`<div class="panel"><h2>${x[0]}</h2><div class="muted">${x[1]}</div><p>${x[2]}</p><span class="tag ${x[3]=='HOT'?'hot':'safe'}">${x[3]}</span></div>`).join('');
 $('#testnetList').innerHTML=testnets.map(x=>`<div class=item><span><b>${x[0]}</b><br><small class=muted>${x[1]}</small></span><span class="tag safe">${x[2]}</span></div>`).join('');
 $('#questList').innerHTML=quests.map((x,i)=>`<div class=item><span><b>${x[0]}</b><br><small class=muted>${x[1]}</small></span><button onclick="completeQuest(${i})">${x[2]}</button></div>`).join('');
 $('#calendarList').innerHTML=calendar.map(x=>`<div class=item><span><b>${x[0]}</b> — ${x[1]}</span><span class=tag>${x[2]}</span></div>`).join('');
}
function show(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'});log('opened '+id+' module')}
$$('#nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));
function log(x){$('#log').innerHTML+=`<div>> ${esc(x)}</div>`;$('#log').scrollTop=99999}
function notify(x){let t=$('#toast');t.textContent=x;t.style.display='block';setTimeout(()=>t.style.display='none',2800)}
function short(a){return a?a.slice(0,7)+'...'+a.slice(-5):'—'}
function validAddress(a){return /^0x[a-fA-F0-9]{40}$/.test(a)}
async function connectWallet(){
 if(!window.ethereum){notify('No browser wallet detected. Install MetaMask or another EVM wallet.');return}
 try{
  provider=new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts',[]);
  signer=await provider.getSigner(); currentAddress=await signer.getAddress();
  const network=await provider.getNetwork();
  if(network.chainId!==1n){try{await provider.send('wallet_switchEthereumChain',[{chainId:'0x1'}]); provider=new ethers.BrowserProvider(window.ethereum);}catch(e){notify('Please switch your wallet to Ethereum Mainnet.'); return}}
  $('#access').textContent='KEY HOLDER'; $('#walletStatus').innerHTML=`<b>${esc(short(currentAddress))}</b> connected<br>Chain ID: ${network.chainId}`;
  $('#walletAddress').textContent=short(currentAddress); $('#connectBtn').textContent='REFRESH WALLET';
  log('wallet connected: '+short(currentAddress)); notify('Wallet connected');
  await loadRealWallet();
 }catch(e){notify(e?.message?.slice(0,100)||'Wallet connection failed.')}
}
async function disconnectWallet(){provider=null;signer=null;currentAddress=null;localStorage.removeItem('key404Connected');$('#access').textContent='GUEST';$('#walletStatus').textContent='No wallet connected.';$('#connectBtn').textContent='CONNECT WALLET';$('#walletAddress').textContent='—';$('#portfolio').textContent='0.00';$('#tokenRows').innerHTML='<div class="muted">Connect a wallet to load live data.</div>';$('#activityList').innerHTML='<div class="muted">Connect a wallet to load live data.</div>';$('#nftList').innerHTML='<div class="muted">Connect a wallet to load live NFT data.</div>';notify('Wallet disconnected')}
async function loadRealWallet(){
 if(!currentAddress) return;
 $('#tokenRows').innerHTML='<div class="muted">Loading live wallet data...</div>';
 try{
  const p=provider||new ethers.JsonRpcProvider(ETH_RPC);
  const bal=await p.getBalance(currentAddress); const eth=Number(ethers.formatEther(bal));
  let price=0; try{const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'); const j=await r.json(); price=j.ethereum?.usd||0}catch{}
  const usd=eth*price; $('#portfolio').textContent=price?usd.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):eth.toFixed(5)+' ETH';
  $('#tokenRows').innerHTML=`<div class=item><span><b>Ethereum</b><br><small class=muted>Native balance</small></span><span><b>${eth.toFixed(6)} ETH</b><br><small class=muted>${price?'$'+usd.toFixed(2):'price unavailable'}</small></span></div>`;
  await Promise.all([loadTransactions(),loadNFTs(),loadTokenBalances()]);
  localStorage.setItem('key404Connected','1');
 }catch(e){$('#tokenRows').innerHTML=`<div class="result">LIVE DATA ERROR: ${esc(e.message)}</div>`}
}
async function loadTokenBalances(){
 try{
  const r=await fetch(`${BLOCKSCOUT}/addresses/${currentAddress}/token-balances`); if(!r.ok)throw Error('Token API unavailable'); const data=await r.json();
  const rows=(Array.isArray(data)?data:[]).filter(x=>x.token?.type==='ERC-20').slice(0,12);
  if(rows.length) $('#tokenRows').innerHTML+=rows.map(x=>{const dec=Number(x.token.decimals??18);const raw=BigInt(x.value||0);let val;try{val=Number(raw)/(10**dec)}catch{val=0}return `<div class=item><span><b>${esc(x.token.symbol||x.token.name||'TOKEN')}</b><br><small class=muted>${esc(x.token.name||'ERC-20')}</small></span><span>${val>0&&val<1e9?val.toLocaleString(undefined,{maximumFractionDigits:6}):'—'}</span></div>`}).join('');
 }catch{}
}
async function loadTransactions(){
 try{
  const r=await fetch(`${BLOCKSCOUT}/addresses/${currentAddress}/transactions?filter=validated`); if(!r.ok)throw Error('Activity API unavailable'); const j=await r.json(); const rows=(j.items||[]).slice(0,12);
  $('#activityList').innerHTML=rows.length?rows.map(x=>{const incoming=x.to?.hash?.toLowerCase()===currentAddress.toLowerCase();const type=x.method|| (incoming?'RECEIVE':'TRANSFER');const val=x.value?Number(ethers.formatEther(x.value)).toFixed(5)+' ETH':'';return `<div class=item><span>${new Date(x.timestamp).toLocaleString()}<br><small class=muted>${short(x.hash)}</small></span><span>${esc(type)}<br><b>${esc(val||'contract')}</b></span></div>`}).join(''):'<div class=muted>No transactions returned.</div>';
 }catch(e){$('#activityList').innerHTML='<div class="muted">Transaction indexer unavailable. Native balance still works.</div>'}
}
async function loadNFTs(){
 try{
  const r=await fetch(`${BLOCKSCOUT}/addresses/${currentAddress}/nft`); if(!r.ok)throw Error('NFT API unavailable'); const j=await r.json(); const rows=(j.items||j||[]).slice(0,12);
  $('#nftList').innerHTML=rows.length?rows.map(x=>`<div class="nft"><div>${esc(x.name||x.token?.name||'NFT')}</div><b>#${esc(x.id||x.token_id||'—')}</b></div>`).join(''):'<div class="muted">No indexed NFTs found.</div>';
 }catch{$('#nftList').innerHTML='<div class="muted">NFT indexer unavailable for this wallet.</div>'}
}
async function checkEligibility(){let v=$('#walletInput').value.trim()||currentAddress;if(!v)return notify('Connect a wallet or enter an address.');if(!validAddress(v))return notify('Enter a valid EVM wallet address.');$('#eligibility').innerHTML='RUNNING LIVE WALLET CHECK...';try{const r=await fetch(`${BLOCKSCOUT}/addresses/${v}`);const j=await r.json();const tx=j.transactions_count??'unknown';$('#eligibility').innerHTML=`<b style="color:var(--green)">WALLET DATA FOUND</b><br><br>Wallet: ${esc(short(v))}<br>Transactions: <b>${esc(tx)}</b><br>Tracked campaigns: <b>${airdrops.length}</b><br><span class="tag safe">RULE ENGINE READY</span><br><small class="muted">Eligibility is project-specific; KEY404 will only mark a campaign eligible when its published rules can be verified.</small>`;log('live wallet eligibility data loaded')}catch(e){$('#eligibility').textContent='Could not reach wallet indexer.'}}
async function scanContract(){let v=$('#contractInput').value.trim();if(!validAddress(v))return notify('Paste a valid EVM contract address.');$('#scanResult').innerHTML='QUERYING BLOCKCHAIN INDEXER...';try{const r=await fetch(`${BLOCKSCOUT}/addresses/${v}`);if(!r.ok)throw Error('not found');const j=await r.json();$('#scanResult').innerHTML=`<b>CONTRACT / ADDRESS FOUND</b><br><br>Address: ${esc(short(v))}<br>Type: ${esc(j.is_contract?'SMART CONTRACT':'EOA / UNKNOWN')}<br>Verified: <span class="tag ${j.is_verified?'safe':'hot'}">${j.is_verified?'YES':'UNKNOWN'}</span><br>Transactions: ${esc(j.transactions_count??'—')}<br><br><small class=muted>Explorer: <a href="${ETH_EXPLORER}/address/${v}" target="_blank" rel="noopener">OPEN BLOCKSCOUT</a></small>`;log('live contract scan completed')}catch(e){$('#scanResult').innerHTML='Contract not found or indexer unavailable.'}}
async function riskCheck(){let v=$('#riskInput').value.trim();if(!validAddress(v))return notify('Paste a valid EVM contract address.');$('#riskResult').innerHTML='RUNNING BASIC LIVE RISK SCREEN...';try{const r=await fetch(`${BLOCKSCOUT}/addresses/${v}`);if(!r.ok)throw Error('not found');const j=await r.json();const signals=[];if(j.is_contract===false)signals.push('Address is not identified as a contract');if(j.is_verified===false)signals.push('Source code is not verified');if(j.has_beacon===true)signals.push('Beacon/proxy relationship detected');$('#riskResult').innerHTML=`<b>BASIC RISK SCREEN</b><br><br>Verified source: <b>${j.is_verified?'YES':'NO / UNKNOWN'}</b><br>Contract detected: <b>${j.is_contract?'YES':'NO / UNKNOWN'}</b><br>Proxy/beacon: <b>${j.has_beacon?'DETECTED':'NOT DETECTED'}</b><br><br>${signals.length?signals.map(s=>`<span class="tag hot">⚠ ${esc(s)}</span><br>`).join(''):'<span class="tag safe">NO BASIC INDEXER SIGNALS</span>'}<br><small class=muted>This is a screening layer, not a security audit or guarantee.</small>`;log('live risk screen completed')}catch{$('#riskResult').textContent='Could not retrieve contract data.'}}
function completeQuest(i){let score=Number(localStorage.getItem('key404score')||0)+[10,50,25,15,20][i];localStorage.setItem('key404score',score);$('#score').textContent=score;notify('Quest completed — XP added');log('quest completed: '+quests[i][0])}
function tick(){let d=new Date();$('#clock').textContent=d.toLocaleTimeString('en-GB')+' LOCAL'}
let p=0;let boot=setInterval(()=>{p+=20;$('#bootpct').textContent=p+'%';if(p>=100){clearInterval(boot);setTimeout(()=>{$('#boot').classList.add('hidden');$('#app').classList.remove('hidden')},300)}},160);
render();setInterval(tick,1000);tick();
