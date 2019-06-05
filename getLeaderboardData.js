import fetch from 'node-fetch';
import convert from 'xml-js';
//import _ from 'lodash';
import fs from 'fs';
import md5 from 'md5';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import csv from 'csvtojson';
import cheerio from 'cheerio';
import tabletojson from 'tabletojson';
import { XmlEntities } from 'html-entities';

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};

console.log('started');
let today = new Date();

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

// console.log('today', today + '');
// console.log('lastMonday', lastMonday + '');
// console.log('nextSunday', nextSunday + '');
// console.log('nextButOneSunday', nextButOneSunday + '');

const saison = '18/19';

let seed = {
	hfi1:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34630&nm=12&' +
		'teamID=437815',
	hfi2: 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=34939&teamID=440182',
	hfi3:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34942&nm=12&' +
		'teamID=440212',
	hfi4:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34984&nm=12&' +
		'teamID=458383',
	a:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34636&nm=12&' +
		'teamID=441694',
	a2:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36424&nm=12&' +
		'teamID=455953',
	b:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36436&nm=12&' +
		'teamID=456028',
	d:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38980&nm=12&' +
		'teamID=481123',
	e:
		'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38983&nm=12&' +
		'teamID=481135',
	f: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36670'
};

let leagues = {
	'M-OLRPS': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34630&all=1'
	// 'M-VL': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34939&all=1',
	// 'M-BZL-O': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34942&all=1',
	// 'M-BL-S': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34984&all=1',
	// 'mJA-OLRPS': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34636&all=1',
	// 'mJA-SLL': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36424&all=1',
	// 'mJB-BZL': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36436&all=1',
	// 'mJD-BZL-4': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38980&all=1',
	// 'mJE-BZL-1': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38983&all=1',
	// 'gJF-M': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36670&all=1'
};

let teams = {
	hfi1: { league: 'M-OLRPS' }
	// hfi2: { league: 'M-VL' },
	// hfi3: { league: 'M-BZL-O' },
	// hfi4: { league: 'M-BL-S' },
	// a: { league: 'mJA-OLRPS' },
	// a2: { league: 'mJA-SLL' },
	// b: { league: 'mJB-BZL' },
	// d: { league: 'mJD-BZL-4' },
	// e: { league: 'mJE-BZL-1' },
	// f: { league: 'gJF-M' }json
};

let promises = [];

Object.keys(leagues).forEach(function(k) {
	promises.push(getHtmlForUrl(k, leagues[k]));
});

Promise.all(promises).then((values) => {
	for (const el of values) {
		console.log('+++++++++' + el.key);

		fs.writeFile(`out/raw/${el.key}.html`, el.html, 'utf8', () =>
			console.log(`raw/${el.key}.html geschrieben`)
		);

		const $ = cheerio.load(el.html);
		try {
			el.scoretable = '<table>' + $('.scoretable').html() + '</table>';
		} catch (e) {
			console.warn('Leaderboard für ' + el.key + ' nicht verfügbar.');
		}
		try {
			el.gametable = '<table>' + $('.gametable').html() + '</table>';
		} catch (e) {
			console.warn('Games and results für ' + el.key + ' nicht verfügbar.');
		}

		if (el.scoretable !== '<table>null</table>') {
			//Leaderboards erzeugen

			//Html
			fs.writeFile(`out/raw/leaderboard.${el.key}.html`, el.scoretable, 'utf8', () =>
				console.log(`leaderboard.${el.key}.html geschrieben`)
			);

			//Json
			const leaderboardRaw = tabletojson.convert(el.scoretable, {
				useFirstRowForHeadings: true,
				stripHtmlFromCells: true,
				forceIndexAsNumber: true
			})[0];

			let leaderBoard = [];
			let first = true;
			for (let row of leaderboardRaw) {
				if (first) {
					first = false;
				} else {
					leaderBoard.push({
						platz: row['0'],
						name: row['1'],
						spiele: row['2'],
						siege: row['3'],
						unentschieden: row['4'],
						niederlagen: row['4'],
						torePlus: row['6'],
						toreMinus: row['8'],
						punktePlus: row['9'],
						punkteMinus: row[11]
					});
				}
			}

			fs.writeFile(
				`out/json/current/leaderboards/${el.key}.json`,
				JSON.stringify(leaderBoard, null, 2),
				'utf8',
				() => console.log(`leaderboard.${el.key}.json geschrieben`)
			);

			//renderedHTML
			let leaderBoardHtml = createLeaderBoardHtml(leaderBoard);
			fs.writeFile(
				`out/html/current/leaderboards/${el.key}.html`,
				leaderBoardHtml,
				'utf8',
				() => console.log(`leaderboards/${el.key}.html geschrieben`)
			);
		}

		if (el.gametable !== '<table>null</table>') {
			// Spiellisten schreiben

			//Html
			fs.writeFile(
				`out/raw/games.and.results.table.${el.key}.html`,
				el.gametable,
				'utf8',
				() => console.log(`/games.and.results.table.${el.key}.html geschrieben`)
			);

			//Json
			const gamesAndResultsRaw = tabletojson.convert(el.gametable, {
				useFirstRowForHeadings: true,
				stripHtmlFromCells: false,
				forceIndexAsNumber: true
			})[0];

			let first = true;
			let gamesAndResults = [];
			for (let row of gamesAndResultsRaw) {
				if (first) {
					first = false;
				} else {
					const halleEL = cheerio.load(row['3']);
					const piEL = cheerio.load(row['10']);

					gamesAndResults.push({
						nr: row['1'],
						datum: row['2'],
						halle: halleEL('a').text(),
						heim: XmlEntities.decode(row['4']),
						gast: XmlEntities.decode(row['6']),
						toreHeim: row['7'],
						toreGast: row['9'],
						linkPI: piEL('a').attr('href'),
						zusatzInfo: piEL('a').attr('title')
					});
				}
			}

			fs.writeFile(
				`out/json/current/games.and.results/${el.key}.json`,
				JSON.stringify(gamesAndResults, null, 2),
				'utf8',
				() => console.log(`games.and.results.${el.key}.json geschrieben`)
			);

			//renderedHTML
			let gamesAndResultsHtml = createGamesAndResultsHtml(gamesAndResults, 'HF Illtal');
			fs.writeFile(
				`out/html/current/games.and.results/hfi/${el.key}.html`,
				leaderBoardHtml,
				'utf8',
				() => console.log(`leaderboards/${el.key}.html geschrieben`)
			);
		}
	}
});

function createLeaderBoardHtml(leaderboard) {
	let html = `<table>
	<tr>
	  <th align="left">Platz</th>
	  <th align="left">Mannschaft</th>
	  <th align="center">Spiele</th>
	  <th align="center">S</th>
	  <th align="center">U</th>
	  <th align="center">N</th>
	  <th align="center"colspan="3">Tore</th>
	  <th align="center" colspan="3">Punkte</th>
	</tr>`;
	for (let row of leaderboard) {
		html += `<tr>
		<td align="center">${row.platz}</td>
		<td align="left">${row.name}</td>
		<td align="center">${row.spiele}</td>
		<td align="center">${row.siege}</td>
		<td align="center">${row.unentschieden}</td>
		<td align="center">${row.niederlagen}</td>
		<td align="center">${row.torePlus}</td>
		<td align="center">:</td>
		<td align="center">${row.toreMinus}</td>
		<td align="center">${row.punktePlus}</td>
		<td align="center">:</td>
		<td align="center">${row.punkteMinus}</td>
	  </tr>`;
	}
	html += `</table>`;
	return html;
}

function createGamesAndResultsHtml(gamesAndResults, filterTeam) {
	let filteredGamesAndResults = gamesAndResults;
	if (filterTeam) {
		filteredGamesAndResults = gamesAndResults.filter(
			(game) => game.heim.includes(filterTeam) || game.gast.includes(filterTeam)
		);
	}
	let html = `<table>
	<tr>
	  <th align="left">Datum</th>
	  <th align="left">Halle</th>
	  <th align="left">Heim</th>
	  <th align="center">:</th>
	  <th align="left">Gast</th>
	  <th align="center"colspan="3">Ergebnis</th>
	  <th align="center">Spielbericht</th>
	</tr>`;
	for (let row of filteredGamesAndResults) {
		html += `<tr>
		<td align="left">${row.datum}</td>
		<td align="left">${row.halle}</td>
		<td align="left">${row.heim}</td>
		<td align="center">:</td>
		<td align="left">${row.gast}</td>
		<td align="center">${row.toreHeim}</td>
		<td align="center">:</td>
		<td align="center">${row.toreGast}</td>
		<td align="center"><a href="${row.linkPI}"</td>
	  </tr>`;
	}
	html += `</table>`;
	return html;
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

async function getHtmlForUrl(key, url) {
	const response = await fetch(url, {
		method: 'get',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
		}
	});

	const html = await response.text();

	return { key: key, html };
}
