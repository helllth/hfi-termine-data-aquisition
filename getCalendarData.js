import fetch from 'node-fetch';
import convert from 'xml-js';
//import _ from 'lodash';
import fs from 'fs';
import md5 from 'md5';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import csv from 'csvtojson';

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};

console.log('started');
let manualDates = JSON.parse(fs.readFileSync('in/manual.json'));
let cancelledGames = JSON.parse(fs.readFileSync('in/cancelled.json'));
let today = new Date();
console.log('today.getDay', today.getDay());

if (today.getDay() === 0) {
	today.setDate(today.getDate() - 1);
}
today.setHours(0);
today.setMinutes(0);

let nextSunday = endOfWeek(today);
let lastMonday = new Date(
	nextSunday.getFullYear(),
	nextSunday.getMonth(),
	nextSunday.getDate() - 6
);
let nextMonday = new Date(
	nextSunday.getFullYear(),
	nextSunday.getMonth(),
	nextSunday.getDate() + 1
);
let nextButOneSunday = endOfWeek(nextSunday);
let nextButOneMonday = new Date(
	nextButOneSunday.getFullYear(),
	nextButOneSunday.getMonth(),
	nextButOneSunday.getDate() + 1
);

console.log('today', today + '');
console.log('lastMonday', lastMonday + '');
console.log('nextSunday', nextSunday + '');
console.log('nextButOneSunday', nextButOneSunday + '');
let msg = getGamesForTeam(
	210032,
	'"Nummer";"Staffel";"Datum";"Zeit";"Hallennummer";"Heim";"Gast";"Hallenname";"Plz' +
		'";"Ort";"Strasse";"Telefon";"Haftmittel?"'
);
let jsg = getGamesForTeam(210047);
//let jsg = [];
Promise.all([ jsg, msg ]).then((values) => {
	//console.log('manualDates', manualDates);

	const all = [].concat(...values).concat(manualDates);

	console.log('all.length', all.length);
	console.log('all.last', all[all.length - 1]);

	const allSorted = all.sort((a, b) => {
		const x = Date.parse(a.ts) || 0;
		const y = Date.parse(b.ts) || 0;
		return x < y ? -1 : x > y ? 1 : 0;
	});
	const thisWeek = all.filter((game) => {
		const testtime = Date.parse(game.ts);
		return testtime > lastMonday.getTime() && testtime <= nextMonday.getTime(); //monday because of the time
	});
	const nextWeek = all.filter((game) => {
		const testtime = Date.parse(game.ts);
		return testtime > nextMonday.getTime() && testtime <= nextButOneMonday.getTime(); //monday because of the time
	});
	const realToday = new Date();
	realToday.setHours(0);
	realToday.setMinutes(0);
	const openGames = all.filter((game) => {
		const testtime = Date.parse(game.ts);
		return testtime >= realToday.getTime();
	});

	writeData('aktuelle.Woche', '', thisWeek);
	writeData('naechste.Woche', '', nextWeek);
	writeData('gesamtSpielplan', '', all);
	writeData('noch.zu.spielen', '', openGames);

	// writeData('aktuelle.Woche.small', getTableForMobileCSV(thisWeek));
	// writeData('naechste.Woche.small', getTableForMobileCSV(nextWeek));
	// writeData('gesamtSpielplan.small', getTableForMobileCSV(all));
	// writeData('noch.zu.spielen.small', getTableForMobileCSV(openGames));

	const teams = [
		'HF Illtal',
		'HF Illtal 2',
		'HF Illtal 3',
		'HF Illtal 4',
		'mJA HF Illtal',
		'mJA HF Illtal 2',
		'mJB HF Illtal',
		'mJD HF Illtal',
		'mJE HF Illtal',
		'gJF HF Illtal'
	];
	for (const team of teams) {
		const openGamesForTeam = all.filter((game) => {
			const testtime = Date.parse(game.ts);
			const teamtest = `<b>${team}</b>`;
			return (
				testtime >= realToday.getTime() &&
				(getHomeTeam(game) === teamtest || getAwayTeam(game) === teamtest)
			);
		});
		writeData(`noch.zu.spielen`, team.replaceAll(' ', '_'), openGamesForTeam);
	}
});

//msg=210032

function writeData(name1, name2, data) {
	const name = name1 + (name2 !== '' ? '.' : '') + name2;
	writeTable(name, getTableCSV(data));
	writeTable(name1 + '.small' + (name2 !== '' ? '.' : '') + name2, getTableForMobileCSV(data));

	fs.writeFile(`out/json/${name}.json`, JSON.stringify(data, null, 2), 'utf8', () =>
		console.log(`${name}.json geschrieben`)
	);
}

function writeTable(name, csvdata) {
	fs.writeFile(`out/${name}.csv`, csvdata, 'utf8', () => console.log(`${name}.csv geschrieben`));
}

function getTableCSV(games) {
	if (games.length > 0) {
		let csv = 'Datum,Uhrzeit,Halle,Ort,Heim,Gast\n';
		let currentDate = undefined;
		for (const game of games) {
			const cancelled = cancelledGames.indexOf(game['Nummer']) !== -1;
			if (currentDate !== game.Datum) {
				currentDate = game.Datum;
				var options = {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				};
				const parsedTimeStamp = new Date(Date.parse(game.ts));
				csv =
					csv +
					`"<font color=""#e3000b"">${getWeekday(parsedTimeStamp)}, ${pad(
						parsedTimeStamp.getDate()
					) +
						'.' +
						pad(parsedTimeStamp.getMonth() + 1) +
						'.' +
						parsedTimeStamp.getFullYear()}</font>",#colspan#,#colspan#,,,\n`;
			}

			if (game.Hallenname !== undefined && game.Hallenname.indexOf('Uchtelfangen') !== -1) {
				game.Hallenname = 'Sporthalle';
				game.Ort = 'Uchtelfangen';
			}
			csv =
				csv +
				`,${evEl(game.Zeit || '??? Uhr', cancelled)},"<div title=""${game.Strasse ||
					'???'}"">${evEl(game.Hallenname || '???', cancelled)}</div>",${evEl(
					game.Ort || '???',
					cancelled
				)},"${evEl(getHomeTeam(game), cancelled)}","${evEl(
					getAwayTeam(game),
					cancelled
				)}"\n`;
		}
		return csv;
	} else {
		return (
			'Datum,Uhrzeit,Halle,Ort,Heim,Gast\n"<div align=""center"">keine Spiele</div>",#c' +
			'olspan#,#colspan#,#colspan#,#colspan#,#colspan#'
		);
	}
}
//manipulation for every element
function evEl(el, strikethrough) {
	if (strikethrough) {
		return `<div style='text-decoration: line-through;'>${el}</div>`;
	} else {
		return el;
	}
}

function getTableForMobileCSV(games) {
	if (games.length > 0) {
		let csv = '<center>⏱</center>,<center>Heim</center>,<center>Gast</center>\n';
		let currentDate = undefined;
		for (const game of games) {
			const cancelled = cancelledGames.indexOf(game['Nummer']) !== -1;

			if (currentDate !== game.Datum) {
				currentDate = game.Datum;
				var options = {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				};
				const parsedTimeStamp = new Date(Date.parse(game.ts));
				csv =
					csv +
					`"<font color=""#e3000b"">${getWeekday(parsedTimeStamp)}, ${pad(
						parsedTimeStamp.getDate()
					) +
						'.' +
						pad(parsedTimeStamp.getMonth() + 1) +
						'.' +
						parsedTimeStamp.getFullYear()}</font>",#colspan#,#colspan#\n`;
			}

			if (game.Hallenname !== undefined && game.Hallenname.indexOf('Uchtelfangen') !== -1) {
				game.Ort = 'Uchtelfangen';
			}
			csv =
				csv +
				`${evEl(game.Zeit || '??? Uhr', cancelled)},"${evEl(
					getHomeTeam(game),
					cancelled
				)}","${evEl(getAwayTeam(game), cancelled)}"\n`;

			const ortsinfo = (game.Hallenname || '???') + ' in ' + (game.Ort || '???');

			csv = csv + `,"<font  size=""2"">${evEl(ortsinfo, cancelled)}</font>",#colspan#\n`;
		}
		return csv;
	} else {
		return (
			'<center>⏱</center>,<center>Heim</center>,<center>Gast</center>\n"<div align=""ce' +
			'nter"">keine Spiele</div>",#colspan#,#colspan#'
		);
	}
}

function pad(n) {
	return n < 10 ? '0' + n : n;
}

function getHomeTeam(game) {
	return getTeamName(game, game.Heim);
}
function getAwayTeam(game) {
	return getTeamName(game, game.Gast);
}
function getTeamName(game, team) {
	if (team.indexOf('Illtal') === -1) {
		return addSpacesForSyllabification(team);
	} else {
		if (team.indexOf('MSG') !== -1) {
			team = team.replace('MSG ', '');
			return `<b>${team}</b>`;
		} else {
			team = team.replace('JSG ', '');
			return `<b>${getJSGPrefix(game)} ${team}</b>`;
		}
	}
}

function addSpacesForSyllabification(_word) {
	let word = _word;
	const charsToEnhanceWithSpaces = [ '/', '-' ];
	for (const eChar of charsToEnhanceWithSpaces) {
		const parts = word.split(eChar);
		const newParts = parts.map((x) => ' ' + x.trim() + ' ');
		word = newParts.join(eChar);
	}
	return word;
}
function getJSGPrefix(game) {
	return game.Staffel.substr(0, game.Staffel.indexOf('-'));
}
function getWeekday(date) {
	switch (date.getDay()) {
		case 0:
			return 'Sonntag';
		case 1:
			return 'Montag';
		case 2:
			return 'Dienstag';
		case 3:
			return 'Mittwoch';
		case 4:
			return 'Donnerstag';
		case 5:
			return 'Freitag';
		case 6:
			return 'Samstag';

		default:
			break;
	}
}
function endOfWeek(date) {
	let d = new Date(date.valueOf());
	var lastday = d.getDate() - (d.getDay() - 1) + 6;
	return new Date(d.setDate(lastday));
}

async function getGamesForTeam(teamId, csvHeader = undefined) {
	console.log('getData for teamId:', teamId);

	const url = 'http://spo.handball4all.de/Spielbetrieb/mannschaftsspielplaene.php';
	let fd = new FormData();
	// 'm=16' -F 'nm=0' -F 'clubno=210032' -F 'lgym=1' -F 'own=1' -F 'onefile=1' -F
	// 'hvwsubmit=dw'
	fd.append('m', 16);
	fd.append('nm', 0);
	fd.append('clubno', teamId);
	fd.append('lgym', 1);
	fd.append('own', 1);
	fd.append('onefile', 1);
	fd.append('hvwsubmit', 'dw');

	const response = await fetch(url, {
		method: 'post',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
		},
		body: fd
	});
	const buffer = await response.buffer();

	var zip = new AdmZip(buffer);
	var zipEntries = zip.getEntries();
	for (var i = 0; i < zipEntries.length; i++) {
		let txt;
		if (csvHeader) {
			txt = csvHeader + '\n';
		} else {
			txt = '';
		}
		txt = txt + zip.readAsText(zipEntries[i], 'binary').trim();
		// console.log('-------------------------------------');
		// console.log('txt', txt);
		// console.log('-------------------------------------');
		const jsonObj = await csv({ noheader: false, delimiter: ';' }).fromString(txt);
		//console.log('JSON', jsonObj);
		for (let entry of jsonObj) {
			// try {
			const day = entry.Datum.substr(0, 2);
			const month = entry.Datum.substr(3, 2);
			const year = '20' + entry.Datum.substr(6, 2);
			var hour = entry.Zeit.substr(0, 2);
			var minute = entry.Zeit.substr(3, 2);
			entry.ts = new Date(year, month - 1, day, hour, minute).toLocaleString('de-DE', {
				timeZone: 'Europe/Berlin'
			});
			// } catch (e) { console.log('fehler', e); console.log('in ', entry); }
		}
		return jsonObj;
	}
}
