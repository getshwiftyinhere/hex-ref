var refElem = document.getElementById("currentRef");
if (window.location.href.includes("r=0x")) { //new ref
  referralAddress = getAllUrlParams(window.location.href).r;
  document.cookie = "r=" + referralAddress + "; expires=Monday, 01 Jan 2120 12:00:00 UTC; path=/";
  refElem.innerHTML = "Referrer: <b>" + referralAddress + "</b>";
  console.log("new ref cookie: " + referralAddress);
} else { //get cookie
  var cookie = getCookie("r");
  if (cookie != "" && cookie.includes("0x")) { //cookie found
    referralAddress = cookie;
    refElem.innerHTML = "Referrer: <b>" + referralAddress + "</b>";
    console.log("cookie ref: " + referralAddress);
  } else { //cookie nor url ref found 
    referralAddress = "0x0000000000000000000000000000000000000000";
    console.log("ref: " + referralAddress);
  }
}

setTimeout(function(){
  PopulateStakeTable();
}, 5000);


async function ApproveHex() {
  var hex = "9999999999999999999999999999999";
  hexContract.methods.approve(hexrefContractAddress, web3.utils.toHex(hex)).send({
      from: activeAccount
    })
    .on('receipt', function (receipt) {
      // receipt example
      console.log("Approve confirmed for HEX");
      successMessage("Successfully approved HEX");
      console.log(receipt);
    })
    .on('error', function () {
      console.error;
      errorMessage("Approve failed, please try again...");
    }); // If there's an out of gas error the second parameter is the receipt  
}

async function StakeHex() {
  if (typeof web3 !== "undefined") {
    var value = document.getElementById("hexStake").value;
    var days = document.getElementById("hexStakeDays").value;
    if(days == 0 || days == null || days == "undefined" && days <= 5555){
      errorMessage("HEX stake days must be > 0 or <= 5555");
      return;
    }
    if(value == 0 || value == null || value == "undefined"){
      errorMessage("HEX amount must be greater than 0");
      return;
    }
    var hearts = value * 10 ** decimals;
    console.log(hearts);
    var allowance = await hexContract.methods.allowance(activeAccount, hexrefContractAddress).call();
    if(allowance < hearts){
      errorMessage("Approve HEX needed");
      return;
    }
    var balance = await hexContract.methods.balanceOf(activeAccount).call();
    if(balance < hearts){
      errorMessage("Not enough HEX in balance");
      return;
    }
    hexrefContract.methods.StakeHex(web3.utils.toHex(hearts.toString()), days, referralAddress).send({
      from: activeAccount
    }).then(function () {
        successMessage("Staked successfully!");
        setTimeout(function(){
          ShowBalance();
          PopulateStakeTable();
        }, 2000);
    });
  }
}

async function EndStake(elem) {
  if (typeof web3 !== "undefined") {
    var stakeId = parseInt(elem.parentElement.parentElement.firstElementChild.innerHTML);
    var stake = await hexrefContract.methods.stakes(stakeId).call();
    if (!stake.isStaking || stake.isActive) {
      errorMessage("no stake to end");
      return;
    }
    var stakeFinished = await hexrefContract.methods.isStakeFinished(stakeId).call();
    if (!stakeFinished) {
      errorMessage("Cannot emergency end-stake!<br/> Note: 24 hours is also appended to account for stake pending time.");
      return;
    }
    hexrefContract.methods.EndStake(stakeId).send({
      from: activeAccount
    }).then(function () {
        successMessage("Stake ended successfully!");
        setTimeout(function(){
          ShowBalance();
          PopulateStakeTable();
        }, 2000);
    });
  }
}

async function PopulateStakeTable() {
  var myActiveStakes;
  var stakeTable = document.getElementById("stakeTable").lastElementChild;
  stakeTable.innerHTML = "";
    //get most recent stakeid
    var lastStakeId = await hexrefContract.methods.last_stake_id().call();
    //get stakeids
    var userInfo = await hexrefContract.methods.getUserInfo(activeAccount).call();
    var stakeIds = userInfo._stakeIds;
    //iterate through stakeIds of user
    myActiveStakes = 0;
    for(var i = 0; i < stakeIds.length; i++){
          var stake = await hexrefContract.methods.stakes(stakeIds[i]).call();
          if(stake.isStaking){
            $("#frownFace").hide();
            var id = stake.stakeId;
            var stakedHearts = stake.heartValue;
            var stakedHex = stakedHearts / 10 ** decimals;
            var stakeLength = stake.dayLength;
            var timestamp = stake.stakeStartTimestamp;
            var daysLeft = await TimeTill(stakeLength, timestamp, stakeLength);

            stakeTable.insertAdjacentHTML('afterbegin', '<tr><th scope="row">' + id + '</th><td>' + toFixedMax(stakedHex, 8) + ' HEX</td><td>' + stakeLength + ' Day/s</td><td>' + daysLeft + '</td><td><button class="takeBtn" onclick="EndStake(this)">End Stake</button></td></tr>');
            myActiveStakes++;
            document.getElementById("activeStakeCount").innerHTML = myActiveStakes;
          }
    }
    PopulateRefTable();
}

async function PopulateRefTable() {
  var refTable = document.getElementById("refTable").lastElementChild;
  //refTable.innerHTML = "";
}

async function getHexWithdrawn(){
  var withdrawn = 0;
  var events = await poolContract.getPastEvents('Withdrawal', {
    fromBlock: 0,
    toBlock: 'latest'
  });
  for(var i = 0; i < events.length; i++){
    if(events[i].returnValues[0] == activeAccount){
      withdrawn += events[i].returnValues[1];
    }
  }
  withdrawn /= 10 ** decimals;
  document.getElementById("myHexWithdrawn").innerHTML = toFixedMax(withdrawn,2);
}

async function TimeTill(_days, timestamp, stakeDays) {

  var now = parseInt(Date.now() / 1000);
  var endTime = parseInt(timestamp) + (oneDaySeconds * (parseInt(_days) + 1));
  var seconds = parseInt(endTime) - parseInt(now);
  console.log(now);
  console.log(endTime);
  console.log(timestamp);
  console.log(seconds);
  if(seconds < 1){
    return "Complete!";
  }
  var minutes = seconds / 60;
  var hours = minutes / 60;
  var days = hours / 24;
  if(days > stakeDays){
    return "Pending...";
  }
  return toFixedMax(days, 1) + " Day/s";
}

async function ShowBalance(){
  hexContract.methods.balanceOf(activeAccount).call().then(function(balance){
    document.getElementById("walletBalance").innerHTML = parseInt(balance / 10 ** decimals) + " HEX";
  });
}

function getDaysTillBPD() {
  var now = new Date();
  var bpdDate = new Date("11/19/2020");
  var Difference_In_Time = bpdDate.getTime() - now.getTime();
  return (Difference_In_Time / (1000 * 3600 * 24));
}

function CheckDays(input){
  var isValid = (input.value <= 5555 && input.value >= 1); 
  if (!isValid){
    errorMessage('Invalid stake length, min 1, max 5555 days');
  }
}

/*-----------------DONATION----------------*/
function DonateEth() {
  if (typeof web3 !== "undefined") {
    Connect();
    //donate
    const input = document.getElementById('ethDonate');
    if (input.value <= 0) {
      return;
    } else {
      let donateWei = new window.web3.utils.BN(
        window.web3.utils.toWei(input.value, "ether")
      );
      window.web3.eth.net.getId().then(netId => {
        return window.web3.eth.getAccounts().then(accounts => {
          return window.web3.eth
            .sendTransaction({
              from: accounts[0],
              to: donationAddress,
              value: donateWei
            })
            .catch(e => {
              alert(e);
            });
        });
      });
    }
  }
}

function DonateHex() {
  if (typeof web3 !== "undefined") {
    Connect();
    //donate
    const input = document.getElementById('hexDonate');
    if (input.value <= 0) {
      return;
    } else {
      let donateTokens = input.value;
      let amount = web3.utils.toBN(donateTokens);

      window.web3.eth.net.getId().then(netId => {
        return window.web3.eth.getAccounts().then(accounts => {
          // calculate ERC20 token amount
          let value = amount * 10 ** decimals;
          // call transfer function
          return hexContract.methods.transfer(donationAddress, value).send({
              from: accounts[0]
            })
            .on('transactionHash', function (hash) {
              successMessage('Thank you! You can see your donation on https://etherscan.io/tx/' + hash);
            });
        }).catch(e => {
          errorMessage('Something went wrong, make sure your wallet is enabled and logged in.');
        });
      });
    }
  }
}

/*----------HELPER FUNCTIONS------------ */

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function getAllUrlParams(url) {

  // get query string from url (optional) or window
  var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  var obj = {};

  // if query string exists
  if (queryString) {

    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    var arr = queryString.split('&');

    for (var i = 0; i < arr.length; i++) {
      // separate the keys and the values
      var a = arr[i].split('=');

      // set parameter name and value (use 'true' if empty)
      var paramName = a[0];
      var paramValue = typeof (a[1]) === 'undefined' ? true : a[1];

      // (optional) keep case consistent
      paramName = paramName.toLowerCase();
      if (typeof paramValue === 'string') paramValue = paramValue.toLowerCase();

      // if the paramName ends with square brackets, e.g. colors[] or colors[2]
      if (paramName.match(/\[(\d+)?\]$/)) {

        // create key if it doesn't exist
        var key = paramName.replace(/\[(\d+)?\]/, '');
        if (!obj[key]) obj[key] = [];

        // if it's an indexed array e.g. colors[2]
        if (paramName.match(/\[\d+\]$/)) {
          // get the index value and add the entry at the appropriate position
          var index = /\[(\d+)\]/.exec(paramName)[1];
          obj[key][index] = paramValue;
        } else {
          // otherwise add the value to the end of the array
          obj[key].push(paramValue);
        }
      } else {
        // we're dealing with a string
        if (!obj[paramName]) {
          // if it doesn't exist, create property
          obj[paramName] = paramValue;
        } else if (obj[paramName] && typeof obj[paramName] === 'string') {
          // if property does exist and it's a string, convert it to an array
          obj[paramName] = [obj[paramName]];
          obj[paramName].push(paramValue);
        } else {
          // otherwise add the property
          obj[paramName].push(paramValue);
        }
      }
    }
  }

  return obj;
}

function numStringToBytes32(num) {
  var bn = new web3.utils.BN(num).toTwos(256);
  return padToBytes32(bn.toString(16));
}

function bytes32ToNumString(bytes32str) {
  bytes32str = bytes32str.replace(/^0x/, '');
  var bn = new web3.utils.BN(bytes32str, 16).fromTwos(256);
  return bn.toString();
}

function bytes32ToInt(bytes32str) {
  bytes32str = bytes32str.replace(/^0x/, '');
  var bn = new web3.utils.BN(bytes32str, 16).fromTwos(256);
  return bn;
}

function padToBytes32(n) {
  while (n.length < 64) {
    n = "0" + n;
  }
  return "0x" + n;
}

function toFixedMax(value, dp) {
  return +parseFloat(value).toFixed(dp);
}