var refShare = 1000;//min 0.1%

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

//setTimeout(function(){
//  PopulateStakeTable();
//}, 5000);


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
    hexrefContract.methods.StakeHex(web3.utils.toHex(hearts.toString()), days, refShare, referralAddress).send({
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
      var conf = await confirm("This stake has not yet finished, ending this stake will result in penalties.\n\nAre you sure you want to end it?\n\n Note: 24 hours is also appended to account for stake pending time.");
      if(conf){
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
    else{
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
}

async function GoodAccounting(elem) {
  if (typeof web3 !== "undefined") {
    var stakeId = parseInt(elem.parentElement.parentElement.firstElementChild.innerHTML);
    var stake = await hexrefContract.methods.stakes(stakeId).call();
    if (stake.stakeEnded){
      successMessage("Stake has already been ended by user.");
      return;
    }
    if (!stake.isStaking || stake.isActive) {
      errorMessage("No stake to end");
      return;
    }
    var stakeFinished = await hexrefContract.methods.isStakeFinished(stakeId).call();
    if (!stakeFinished) {
      errorMessage("Not finished yet!<br/> Note: 24 hours is also appended to account for stake pending time.");
      return;
    }
    var hexStakeIndex = stake.hexStakeIndex;
    var hexStakeId = stake.hexStakeId;
    hexContract.methods.stakeGoodAccounting(hexrefContract, hexStakeIndex, hexStakeId).send({
      from: activeAccount
    }).then(function () {
        successMessage("Good accounting successful!");
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
    document.getElementById("userCount").innerHTML = await hexrefContract.methods.userCount().call(); 
    document.getElementById("totalStakeCount").innerHTML = lastStakeId;
    //iterate through stakeIds of user
    myActiveStakes = 0;
    for(var i = 0; i < stakeIds.length; i++){
          var stake = await hexrefContract.methods.stakes(stakeIds[i]).call();
          if(stake.isStaking){
            var id = stake.stakeId;
            var stakedHearts = stake.heartValue;
            var stakedHex = stakedHearts / 10 ** decimals;
            var interestHearts = await hexrefContract.methods.getInterestByStakeId(hexrefContractAddress, stake.hexStakeId).call();
            var refShare = interestHearts / stake.refShare;
            var refPercent = (refShare / interestHearts) * 100;
            var interestHex = interestHearts / 10 ** decimals;
            var stakeLength = stake.dayLength;
            var referrer;
            if(stake.refferer == "0x0000000000000000000000000000000000000000"){
              referrer = "Developer";
            }
            else{
              referrer = stake.refferer.substring(0, 4) + '...' + stake.refferer.substring(stake.refferer.length - 4);
            }
            var timestamp = stake.stakeStartTimestamp;
            var daysLeft = await TimeTill(stakeLength, timestamp, stakeLength);
            if(daysLeft == "Pending..." || interestHex == 0){
              refPercent = "";
            }
            else{
              refPercent = toFixedMax(refPercent, 2) + "%";
            }
            stakeTable.insertAdjacentHTML('afterbegin', '<tr><th scope="row">' + id + '</th><td>' + toFixedMax(stakedHex, 8) + ' HEX</td><td>' + toFixedMax(interestHex, 8) + ' HEX</td><td>' + stakeLength + ' Day/s</td><td>' + daysLeft + '</td><td>' + referrer + '<br/>' + refPercent + '</td><td><button class="takeBtn" onclick="EndStake(this)"><i class="fa fa-unlock"></i>&nbsp;End Stake</button></td></tr>');
            myActiveStakes++;
            document.getElementById("activeStakeCount").innerHTML = myActiveStakes;
          }
    }
    PopulateRefTable();
}

async function PopulateRefTable() {
  var myRefStakes;
  var refTable = document.getElementById("refTable").lastElementChild;
  refTable.innerHTML = "";
      //get most recent stakeid
      var lastStakeId = await hexrefContract.methods.last_stake_id().call();
      //iterate through stakeIds of user
      myRefStakes = 0;
      for(var i = 0; i <= lastStakeId; i++){
              //get stakeids
            var stake = await hexrefContract.methods.stakes(i).call();
            var id = stake.stakeId;
            var refStake = stake.refferer.toUpperCase() === activeAccount.toUpperCase();
            if(refStake){
              if(stake.isStaking){
                var stakedHearts = stake.heartValue;
                var stakedHex = stakedHearts / 10 ** decimals;
                var stakeProfitHearts = await hexrefContract.methods.getInterestByStakeId(hexrefContractAddress, stake.hexStakeId).call();
                var yourProfitHearts = stakeProfitHearts / stake.refShare;
                var refShare = stakeProfitHearts / stake.refShare;
                var refPercent = (refShare / stakeProfitHearts) * 100;
                //yourProfitHearts = yourProfitHearts / 100 * 90; //90% (10% to dev);

                var stakeProfitHex = stakeProfitHearts / 10 ** decimals;
                var yourProfitHex = yourProfitHearts / 10 ** decimals;
                var stakeLength = stake.dayLength;
                var user = stake.userAddress;
                user = user.substring(0, 4) + '...' + user.substring(user.length - 4);
                var timestamp = stake.stakeStartTimestamp;
                var daysLeft = await TimeTill(stakeLength, timestamp, stakeLength);
                if(daysLeft == "Pending..." || stakeProfitHearts == 0){
                  refPercent = "";
                }
                else{
                  refPercent = toFixedMax(refPercent, 2) + "%";
                }
                refTable.insertAdjacentHTML('afterbegin', '<tr><td style="visibility:collapse" width="0%">' + id + '</td><th scope="row">' + user + '</th><td>' + toFixedMax(stakedHex, 8) + ' HEX</td><td>' + stakeLength + ' Day/s</td><td>' + daysLeft + '</td><td>' + toFixedMax(stakeProfitHex, 8) + ' HEX</td><td>' + toFixedMax(yourProfitHex, 8) + ' HEX<br/>'+ refPercent +'</td><td><button class="takeBtn" onclick="GoodAccounting(this)"><i class="fa fa-handshake"></i>&nbsp;Good Accounting</button></td></tr>');
                myRefStakes++;
                document.getElementById("refStakeCount").innerHTML = myRefStakes;
              }
              else{
                var stakedHearts = stake.stakeValue;
                var stakedHex = stakedHearts / 10 ** decimals;
                var stakeProfitHearts = stake.stakeProfit;
                var yourProfitHearts = stakeProfitHearts / stake.refShare;
                var refShare = stakeProfitHearts / stake.refShare;
                var refPercent = (refShare / stakeProfitHearts) * 100;
                //yourProfitHearts = yourProfitHearts / 100 * 90; //90% (10% to dev);

                var stakeProfitHex = stakeProfitHearts / 10 ** decimals;
                var yourProfitHex = yourProfitHearts / 10 ** decimals;
                var stakeLength = stake.dayLength;
                var user = stake.userAddress;
                user = user.substring(0, 4) + '...' + user.substring(user.length - 4);
                var timestamp = stake.stakeStartTimestamp;
                var daysLeft = await TimeTill(stakeLength, timestamp, stakeLength);
                if(daysLeft == "Complete"){
                  refPercent = toFixedMax(refPercent, 2) + "%";
                }
                refTable.insertAdjacentHTML('afterbegin', '<tr><td style="visibility:collapse">' + id + '</td><th scope="row">' + user + '</th><td>' + toFixedMax(stakedHex, 8) + ' HEX</td><td>' + stakeLength + ' Day/s</td><td>' + daysLeft + '</td><td>' + toFixedMax(stakeProfitHex, 8) + ' HEX</td><td>' + toFixedMax(yourProfitHex, 8) + ' HEX</td><td><button class="takeBtn" onclick="GoodAccounting(this)">Good Accounting</button></td></tr>');
                myRefStakes++;
                document.getElementById("refStakeCount").innerHTML = myRefStakes;
              }
            }
      }
      PopulateLeaderboard();
}

function doSort(ascending) {
	ascending = typeof ascending == 'undefined' || ascending == true;
	return function (a, b) {
		var ret = a[1] - b[1];
		return ascending ? ret : -ret;
	};
}
async function PopulateLeaderboard() {
  const latest = await web3.eth.getBlockNumber()
  var totalReferred = 0;
  var referrerCount = 0;
  var calcRefs = 0;
  var leaderboardTable = document.getElementById("refLeaderboard").lastElementChild;
  leaderboardTable.innerHTML = "";
	referrersL = [[]];
	try {
		var events = await hexrefContract.getPastEvents('StakeStarted', {
			fromBlock: 0,
			toBlock: latest
		});
		for (var i = 0; i < events.length; i++) {
      var user = events[i].returnValues[3];
      if(user != "0x0000000000000000000000000000000000000000"){
        var value = events[i].returnValues[0];
        totalReferred += parseInt(value);
        var ref = [user, parseInt(value), user];
        referrersL.push(ref);
        var noPreviousRefs = true;
        //check if any previous refs from same address
        for (var r = 0; r < referrersL.length - 1; r++) {
          if (user == referrersL[r][0]) {
            //add value to previous ref
            referrersL[r][1] += parseInt(value);
            calcRefs += parseInt(value);
            //remove latest ref from array
            referrersL.pop();
            noPreviousRefs = false;
          }
        }
        //first ref
        if (noPreviousRefs) {
          calcRefs += parseInt(value);
        }
      }
		}
		//sort array in order
	  referrersL = referrersL.sort(doSort(false));

		//count and display array values
		for (var r = 1; r < referrersL.length; r++) {
      referrerCount++;
      var addy = referrersL[r][0];
      referrersL[r][0] = addy.substring(0, 6) + '...' + addy.substring(addy.length - 6);
      referrersL[r][1] /= 10 ** 8;
		}
    leaderboardTable.insertAdjacentHTML("afterbegin", "<tr><td><a href='https://hexref.win/?r=" + referrersL[1][2] + "'>" + referrersL[1][0]+"</a></td><td>" + referrersL[1][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[2][2] + "'>" + referrersL[2][0]+"</a></td><td>" + referrersL[2][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[3][2] + "'>" + referrersL[3][0]+"</a></td><td>" + referrersL[3][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[4][2] + "'>" + referrersL[4][0]+"</a></td><td>" + referrersL[4][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[5][2] + "'>" + referrersL[5][0]+"</a></td><td>" + referrersL[5][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[6][2] + "'>" + referrersL[6][0]+"</a></td><td>" + referrersL[6][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[7][2] + "'>" + referrersL[7][0]+"</a></td><td>" + referrersL[7][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[8][2] + "'>" + referrersL[8][0]+"</a></td><td>" + referrersL[8][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[9][2] + "'>" + referrersL[9][0]+"</a></td><td>" + referrersL[9][1] + " HEX</td></tr><tr><td><a href='https://hexref.win/?r=" + referrersL[10][2] + "'>" + referrersL[10][0]+"</a></td><td>" + referrersL[10][1] + " HEX</td></tr>");
		console.log("referrer count: " + referrerCount);
	} catch (e) {
		console.log(e);
  }
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
  if(days < 1){
    return toFixedMax(hours,1) + " Hour/s";
  }
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

function SetRate(input){
  var isValid = (input.value <= 50 && input.value >= 0.1); 
  if (!isValid){
    errorMessage('Invalid ref share, min 0.1%, max 50%');
    if(input.value > 50){
      input.value = 50;
    }
    if(input.value < 0.1){
      input.value = 0.1;
    }
  }
  else{
    refShare = parseInt((100 / input.value));
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