import fetch from 'node-fetch';
import convert from 'xml-js';
//import _ from 'lodash';
import fs from 'fs-extra';
import md5 from 'md5';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import csv from 'csvtojson';
import cheerio from 'cheerio';
import tabletojson from 'tabletojson';
import { XmlEntities } from 'html-entities';
import { writeFileWithMD5 } from './tools';

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};

// read config
let teams = fs.readJsonSync('in/teams.json');
let tagLookup = fs.readJsonSync('in/tagLookup.json');
let seasonConf = fs.readJsonSync('in/seasonConf.json');

const saison = seasonConf.current;
//const saison = 'test';

fs.ensureDirSync('out/json/current/leaderboards/');
fs.ensureDirSync('out/json/config');
fs.ensureDirSync('out/json/current/games.and.results/complete/');
fs.ensureDirSync('out/json/current/games.and.results/hfi/');
fs.ensureDirSync('out/html/current/leaderboards/');
fs.ensureDirSync('out/html/current/games.and.results/hfi/');

fs.ensureDirSync(`out/json/${saison}/leaderboards/`);
fs.ensureDirSync(`out/json/${saison}/games.and.results/complete/`);
fs.ensureDirSync(`out/json/${saison}/games.and.results/hfi/`);
fs.ensureDirSync(`out/html/${saison}/leaderboards/`);
fs.ensureDirSync(`out/html/${saison}/games.and.results/hfi/`);
fs.ensureDirSync(`out/raw`);

//hallenverz

let hallenverz = {};

try {
	hallenverz = fs.readJsonSync('./out/json/hallenverzeichnis.json');
} catch (error) {
	//skip
}

const getHalle = (nummer) => {
	const hit = hallenverz.find((element) => {
		return element['#Nummer'] === nummer;
	});
	if (hit !== undefined) {
		return hit;
	} else {
		return nummer;
	}
};

writeFileWithMD5(`out/json/config/teams.json`, JSON.stringify(teams, null, 2));
writeFileWithMD5(`out/json/config/tagLookup.json`, JSON.stringify(tagLookup, null, 2));
writeFileWithMD5(`out/json/config/seasonConf.json`, JSON.stringify(seasonConf, null, 2));

let promises = [];

console.log('do it for season', saison);

Object.keys(teams[saison]).forEach(function(category) {
	Object.keys(teams[saison][category].teams).forEach(function(teamKey) {
		const team = teams[saison][category].teams[teamKey];
		team.key = teamKey;
		// team.season = saison;
		// team.category = teams[saison][category].name;
		promises.push(getHtmlForUrl(team));
	});
});

writeFileWithMD5(`out/json/config/teams.json`, JSON.stringify(teams, null, 2));

Promise.all(promises).then((values) => {
	for (const teamAndHtml of values) {
		let team = teamAndHtml.team;

		console.log('+++++++++' + team.leaguename + ' for team ' + team.name);

		writeFileWithMD5(`out/raw/${team.key}.html`, teamAndHtml.html);

		const $ = cheerio.load(teamAndHtml.html);
		try {
			teamAndHtml.scoretable = '<table>' + $('.scoretable').html() + '</table>';
		} catch (e) {
			console.warn('Leaderboard für ' + team + ' nicht verfügbar.');
		}
		try {
			teamAndHtml.gametable = '<table>' + $('.gametable').html() + '</table>';
		} catch (e) {
			console.warn('Games and results für ' + team + ' nicht verfügbar.');
		}

		if (teamAndHtml.scoretable !== '<table>null</table>') {
			//Leaderboards erzeugen Html
			writeFileWithMD5(`out/raw/leaderboard.${team.key}.html`, teamAndHtml.scoretable);

			//Json
			const leaderboardRaw = tabletojson.convert(teamAndHtml.scoretable, {
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
						name: row['1'].replace(
							team.leaderboardNameReplacementFrom || '',
							team.leaderboardNameReplacementTo || ''
						),
						spiele: row['2'],
						siege: row['3'],
						unentschieden: row['4'],
						niederlagen: row['5'],
						torePlus: row['6'],
						toreMinus: row['8'],
						punktePlus: row['9'],
						punkteMinus: row[11]
					});
				}
			}

			if (true || teams[saison][team].league.length === 1) {
				writeFileWithMD5(
					`out/json/current/leaderboards/${team.key}.json`,
					JSON.stringify(leaderBoard, null, 2)
				);
				writeFileWithMD5(
					`out/json/${saison}/leaderboards/${team.key}.json`,
					JSON.stringify(leaderBoard, null, 2)
				);

				//renderedHTML
				let leaderBoardHtml = createLeaderBoardHtml(leaderBoard);
				writeFileWithMD5(`out/html/current/leaderboards/${team.key}.html`, leaderBoardHtml);
				writeFileWithMD5(
					`out/html/${saison}/leaderboards/${team.key}.html`,
					leaderBoardHtml
				);
			} else {
				//TODO
				//add here the code for teams with multiple leagues
			}
		}

		if (teamAndHtml.gametable !== '<table>null</table>') {
			// Spiellisten schreiben Html
			writeFileWithMD5(
				`out/raw/games.and.results.table.${team.key}.html`,
				teamAndHtml.gametable
			);

			//Json
			const gamesAndResultsRaw = tabletojson.convert(teamAndHtml.gametable, {
				useFirstRowForHeadings: true,
				stripHtmlFromCells: false,
				forceIndexAsNumber: true
			})[0];

			let first = true;
			let gamesAndResults = [];
			let gamesAndResultsWitCompletehHalle = [];

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
						heim: XmlEntities.decode(row['4']).replace(
							team.gamesNameReplacementFrom || '',
							team.gamesNameReplacementTo || ''
						),
						gast: XmlEntities.decode(row['6']).replace(
							team.gamesNameReplacementFrom || '',
							team.gamesNameReplacementTo || ''
						),
						toreHeim: row['7'],
						toreGast: row['9'],
						linkPI: piEL('a').attr('href'),
						zusatzInfo: piEL('a').attr('title')
					});
					gamesAndResultsWitCompletehHalle.push({
						nr: row['1'],
						datum: row['2'],
						halle: getHalle(halleEL('a').text()),
						heim: XmlEntities.decode(row['4']).replace(
							team.gamesNameReplacementFrom || '',
							team.gamesNameReplacementTo || ''
						),
						gast: XmlEntities.decode(row['6']).replace(
							team.gamesNameReplacementFrom || '',
							team.gamesNameReplacementTo || ''
						),
						toreHeim: row['7'],
						toreGast: row['9'],
						linkPI: piEL('a').attr('href'),
						zusatzInfo: piEL('a').attr('title')
					});
				}
			}

			writeFileWithMD5(
				`out/json/current/games.and.results/complete/${team.key}.json`,
				JSON.stringify(gamesAndResults, null, 2)
			);
			writeFileWithMD5(
				`out/json/${saison}/games.and.results/complete/${team.key}.json`,
				JSON.stringify(gamesAndResults, null, 2)
			);

			//für HFI
			//renderedHTML Spielplan
			let gamesAndResultsHtml = createGamesAndResultsHtml(
				gamesAndResultsWitCompletehHalle,
				team.filter || 'Illtal'
			);
			writeFileWithMD5(
				`out/html/current/games.and.results/hfi/${team.key}.html`,
				gamesAndResultsHtml
			);
			writeFileWithMD5(
				`out/html/${saison}/games.and.results/hfi/${team.key}.html`,
				gamesAndResultsHtml
			);

			// filtered JSON
			let filteredGamesAndResults = gamesAndResults;
			let filterTeam = team.filter || 'Illtal';
			if (filterTeam) {
				filteredGamesAndResults = gamesAndResults.filter(
					(game) => game.heim.includes(filterTeam) || game.gast.includes(filterTeam)
				);
			}
			writeFileWithMD5(
				`out/json/current/games.and.results/hfi/${team.key}.json`,
				JSON.stringify(filteredGamesAndResults, null, 2)
			);
			writeFileWithMD5(
				`out/json/${saison}/games.and.results/hfi/${team.key}.json`,
				JSON.stringify(filteredGamesAndResults, null, 2)
			);
		}
	}
});

function createLeaderBoardHtml(leaderboard, nameReplacement = { from: '', to: '' }) {
	let html = `<table>
	<tr>
	  <th align="left">Platz</th>
	  <th align="left">Mannschaft</th>
	  <th align="center">Spiele</th>
	  <th align="center">S/U/N</th> 
	  <th align="center"colspan="3">Tore</th>
	  <th align="center" colspan="3">Punkte</th>
	</tr>`;
	for (let row of leaderboard) {
		html += `<tr>
		<td align="center">${row.platz}</td>
		<td align="left">${row.name}</td>
		<td align="center">${row.spiele}</td>
		<td align="center">${row.siege}/${row.unentschieden}/${row.niederlagen}</td>
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
		// if (filteredGamesAndResults.length === 0) {
		// 	filteredGamesAndResults = gamesAndResults.filter(
		// 		(game) => game.heim.includes('JSG Dir') || game.gast.includes('JSG Dir')
		// 	);
		// }
	}
	let html = `<table>
	<tr>
	  <th align="left">Datum</th>
	  <th align="left">Halle</th>
	  <th align="left">Heim</th>
	  <th align="left">Gast</th>
	  <th align="center"colspan="2">Ergebnis</th>
	  <th align="center">Spielbericht</th>
	</tr>`;

	for (let row of filteredGamesAndResults) {
		let halle;
		if (row.halle.Name !== undefined) {
			let ort;
			if (row.halle.Stadt === 'Eppelborn') {
				halle = 'Hellberghalle';
			} else if (row.halle.Stadt === 'Illingen') {
				halle = 'Uchtelfangen';
			} else {
				ort = row.halle.Stadt + ', ';
				halle = `<a target="_maps" href="https://www.google.com/maps/search/${row.halle
					.Plz} ${row.halle.Stadt}, ${row.halle.Name}, ${row.halle.Strasse ||
					''}"><img title="${ort +
					row.halle.Name}" src="https://hfi-data.cismet.de/icons/location.png"/></a>`;
			}
		} else {
			halle = `<img title="Hallennummer: ${row.halle}" src="https://hfi-data.cismet.de/icons/location.png"/>`;
		}

		html += `<tr>
		<td align="left" ondblclick="window.alert('Tag zur Verlinkung der Berichte: ${tagLookup[
			saison
		]}.${row.nr}')">${row.datum}</td>
		<td align="center">${halle}</td>
		<td align="left">${row.heim}</td>
		<td align="left">${row.gast}</td>
		<td align="center">${row.toreHeim}</td>
		<td align="center">${row.toreGast}</td>`;

		if (row.linkPI !== undefined) {
			html += `<td align="center"><a target="_handball4all" href="${row.linkPI}">Spielbericht</a></td>`;
		} else {
			html += `<td align="center"></td>`;
		}

		html += `
	  </tr>`;
	}
	html += `</table>`;
	return html;
}

function pad(n) {
	return n < 10 ? '0' + n : n;
}

async function getHtmlForUrl(team) {
	const response = await fetch(team.league, {
		method: 'get',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
		}
	});

	const html = await response.text();

	return { team: team, html };
}
