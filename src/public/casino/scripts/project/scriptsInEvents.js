


const scriptsInEvents = {

	async EventSheet1_Event3(runtime, localVars)
	{
		var xhttp = new XMLHttpRequest();
		xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
		xhttp.setRequestHeader('Content-Type', 'application/json');
		xhttp.onload = () => {
			const userbal = JSON.parse(xhttp.responseText);
			runtime.globalVars.Balance = Number(userbal.Balance);
		};
		xhttp.send(JSON.stringify({'Balance':'SystemCheck'}));
	},

	async EventSheet1_Event9_Act3(runtime, localVars)
	{
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://itsinhaleyo.online/callback/miniroulette/bet", true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify({'bet':runtime.globalVars.Bet_amount}));
	},

	async EventSheet1_Event11_Act3(runtime, localVars)
	{
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://itsinhaleyo.online/callback/miniroulette/win", true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify({'win':13, 'bet':runtime.globalVars.Bet_amount}));
	},

	async EventSheet1_Event14_Act3(runtime, localVars)
	{
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://itsinhaleyo.online/callback/miniroulette/win", true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify({'win':2, 'bet':runtime.globalVars.Bet_amount}));
	},

	async EventSheet1_Event16_Act3(runtime, localVars)
	{
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://itsinhaleyo.online/callback/miniroulette/win", true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify({'win':2, 'bet':runtime.globalVars.Bet_amount}));
	},

	async EventSheet1_Event110_Act1(runtime, localVars)
	{
		window.location.href = "https://itsinhaleyo.online/casino";
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;

