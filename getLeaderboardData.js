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

//const saison = '2018_2019';
const saison = '2019_2020';
//const saison = 'test';

fs.ensureDirSync('out/json/current/leaderboards/');
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

let leagues = {
	'2018_2019': {
		'M-OLRPS':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34630&all=1',
		'M-VL': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34939&all=1',
		'M-BZL-O':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34942&all=1',
		'M-BL-S': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34984&all=1',
		'mJA-OLRPS':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34636&all=1',
		'mJA-SLL':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36424&all=1',
		'mJB-BZL':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36436&all=1',
		'mJD-BZL-N': 'https://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=36562&all=1',
		'mJD-BZL-4':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38980&all=1',
		'mJE-BZL-O': 'https://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=36565',
		'mJE-BZL-1':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38983&all=1',
		'gJF-M': 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36670&all=1'
	},
	'2019_2020': {
		'M-OLRPS':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=79&score=44241&all=1',
		'M-SLL': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=47431&all=1',
		'M-BZL-O': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=47441&all=1',
		'M-BL-N': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=47851&all=1',
		'mJA-OLRPS':
			'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=79&score=44486&all=1',
		'mJA-SLL': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=48561&all=1',
		'mJB-SLL': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=48566&all=1',
		'mJD-BZL-M': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50206&all=1',
		'mJD-BZL-O': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50201&all=1',
		'mJE-BZL-O': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50216&all=1',
		'gJF-O': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50446'
	},
	test: {
		'mJD-BZL-O': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50201&all=1',
		'mJD-BZL-M': 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=50206&all=1'
	}
};

let teams = {
	'2018_2019': {
		hfi1: {
			league: [ 'M-OLRPS' ]
		},
		hfi2: { league: [ 'M-VL' ] },
		hfi3: { league: [ 'M-BZL-O' ] },
		hfi4: {
			league: [ 'M-BL-S' ]
		},
		hfi_a: { league: [ 'mJA-OLRPS' ] },
		hfi_a2: { league: [ 'mJA-SLL' ] },
		hfi_b: {
			league: [ 'mJB-BZL' ]
		},
		hfi_d: { league: [ 'mJD-BZL-N', 'mJD-BZL-4' ] },
		hfi_e: { league: [ 'mJE-BZL-O', 'mJE-BZL-1' ] },
		hfi_f: { league: [ 'gJF-M' ] }
	},
	'2019_2020': {
		hfi1: {
			league: [ 'M-OLRPS' ]
		},
		hfi2: { league: [ 'M-SLL' ] },
		hfi3: { league: [ 'M-BZL-O' ] },
		hfi4: {
			league: [ 'M-BL-N' ]
		},
		hfi_a: { league: [ 'mJA-OLRPS' ] },
		hfi_a2: { league: [ 'mJA-SLL' ] },
		hfi_b: {
			league: [ 'mJB-SLL' ]
		},
		hfi_d: { league: [ 'mJD-BZL-O' ] },
		hfi_d2: { league: [ 'mJD-BZL-M' ] },
		hfi_e: { league: [ 'mJE-BZL-O' ] },
		hfi_f: { league: [ 'gJF-O' ] }
	},
	test: {
		hfi_d: { league: [ 'mJD-BZL-O' ] },
		hfi_d2: { league: [ 'mJD-BZL-M' ] }
	}
};

let leagueNames = {
	'M-OLRPS': 'Männer Oberliga RPS',
	'M-SLL': 'Saarlandliga Männer',
	'M-VL': 'Verbandsliga Männer',
	'M-BZL-O': 'Bezirksliga Ost Männer',
	'M-BL-S': 'B Liga Süd Männer',
	'M-BL-N': 'B Liga Nord Männer',
	'mJA-OLRPS': 'männliche Jugend A Oberliga RPS',
	'mJA-SLL': 'Saarlandliga männliche Jugend A',
	'mJB-SLL': 'Saarlandliga männliche Jugend B',
	'mJB-BZL': 'Bezirksliga männliche Jugend B',
	'mJD-BZL-N': 'Bezirksliga männliche Jugend D Staffel Nord',
	'mJD-BZL-M': 'Bezirksliga männliche Jugend D Staffel Mitte',
	'mJD-BZL-O': 'Bezirksliga männliche Jugend D Staffel Ost',
	'mJD-BZL-4': 'Bezirksliga männliche Jugend D Staffel 4',
	'mJE-BZL-O': 'Bezirksliga männliche Jugend E Staffel Ost',
	'mJE-BZL-1': 'Bezirksliga männliche Jugend E Staffel 1',
	'gJF-M': 'gemischte Jugend F Staffel Mitte',
	'gJF-O': 'gemischte Jugend F Staffel Ost'
};

let tagLookup = {
	'2019_2020': '19.20',
	'2018_2019': '18.19'
};

let reverseLL = {};
//reverse leagueLookup erzeugen
Object.keys(teams[saison]).forEach(function(k) {
	for (const league of teams[saison][k].league) {
		reverseLL[league] = k;
	}
});

let promises = [];

Object.keys(leagues[saison]).forEach(function(k) {
	promises.push(getHtmlForUrl(k, leagues[saison][k]));
});

Promise.all(promises).then((values) => {
	for (const el of values) {
		let team = reverseLL[el.key];

		console.log('+++++++++' + el.key + ' for team ' + team);

		writeFileWithMD5(`out/raw/${team}.html`, el.html, 'utf8', () =>
			console.log(`raw/${team}.html geschrieben`)
		);

		const $ = cheerio.load(el.html);
		try {
			el.scoretable = '<table>' + $('.scoretable').html() + '</table>';
		} catch (e) {
			console.warn('Leaderboard für ' + team + ' nicht verfügbar.');
		}
		try {
			el.gametable = '<table>' + $('.gametable').html() + '</table>';
		} catch (e) {
			console.warn('Games and results für ' + team + ' nicht verfügbar.');
		}

		if (el.scoretable !== '<table>null</table>') {
			//Leaderboards erzeugen Html
			writeFileWithMD5(`out/raw/leaderboard.${team}.html`, el.scoretable, 'utf8', () =>
				console.log(`leaderboard.${team}.html geschrieben`)
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
						name: row['1'].replace(
							'SG JSG HF Illtal - HSG Dudweiler-Fischbach',
							'JSG HF Illtal'
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
					`out/json/current/leaderboards/${team}.json`,
					JSON.stringify(leaderBoard, null, 2),
					'utf8',
					() => console.log(`leaderboard.${team}.json geschrieben`)
				);
				writeFileWithMD5(
					`out/json/${saison}/leaderboards/${team}.json`,
					JSON.stringify(leaderBoard, null, 2),
					'utf8',
					() => console.log(`leaderboard.${team}.json geschrieben`)
				);

				//renderedHTML
				let leaderBoardHtml = createLeaderBoardHtml(leaderBoard);
				writeFileWithMD5(
					`out/html/current/leaderboards/${team}.html`,
					leaderBoardHtml,
					'utf8',
					() => console.log(`leaderboard.${team}.html geschrieben`)
				);
				writeFileWithMD5(
					`out/html/${saison}/leaderboards/${team}.html`,
					leaderBoardHtml,
					'utf8',
					() => console.log(`leaderboard.${team}.html geschrieben`)
				);
			} else {
				//TODO
				//add here the code for teams with multiple leagues
			}
		}

		if (el.gametable !== '<table>null</table>') {
			// Spiellisten schreiben Html
			writeFileWithMD5(
				`out/raw/games.and.results.table.${team}.html`,
				el.gametable,
				'utf8',
				() => console.log(`/games.and.results.table.${team}.html geschrieben`)
			);

			//Json
			const gamesAndResultsRaw = tabletojson.convert(el.gametable, {
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
							'SG Illt-Dud-Fb',
							'JSG HF Illtal'
						),
						gast: XmlEntities.decode(row['6']).replace(
							'SG Illt-Dud-Fb',
							'JSG HF Illtal'
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
							'SG Illt-Dud-Fb',
							'JSG HF Illtal'
						),
						gast: XmlEntities.decode(row['6']).replace(
							'SG Illt-Dud-Fb',
							'JSG HF Illtal'
						),
						toreHeim: row['7'],
						toreGast: row['9'],
						linkPI: piEL('a').attr('href'),
						zusatzInfo: piEL('a').attr('title')
					});
				}
			}

			writeFileWithMD5(
				`out/json/current/games.and.results/complete/${team}.json`,
				JSON.stringify(gamesAndResults, null, 2),
				'utf8',
				() => console.log(`games.and.results.${team}.json geschrieben`)
			);
			writeFileWithMD5(
				`out/json/${saison}/games.and.results/complete/${team}.json`,
				JSON.stringify(gamesAndResults, null, 2),
				'utf8',
				() => console.log(`games.and.results.${team}.json geschrieben`)
			);

			//für HFI
			//renderedHTML Spielplan
			let gamesAndResultsHtml = createGamesAndResultsHtml(
				gamesAndResultsWitCompletehHalle,
				'Illtal'
			);
			writeFileWithMD5(
				`out/html/current/games.and.results/hfi/${team}.html`,
				gamesAndResultsHtml,
				'utf8',
				() => console.log(`games.and.results/hfi/${team}.html geschrieben`)
			);
			writeFileWithMD5(
				`out/html/${saison}/games.and.results/hfi/${team}.html`,
				gamesAndResultsHtml,
				'utf8',
				() => console.log(`games.and.results/hfi/${team}.html geschrieben`)
			);

			// filtered JSON
			let filteredGamesAndResults = gamesAndResults;
			let filterTeam = 'Illtal';
			if (filterTeam) {
				filteredGamesAndResults = gamesAndResults.filter(
					(game) => game.heim.includes(filterTeam) || game.gast.includes(filterTeam)
				);
			}
			writeFileWithMD5(
				`out/json/current/games.and.results/hfi/${team}.json`,
				JSON.stringify(filteredGamesAndResults, null, 2),
				'utf8',
				() => console.log(`hfi/games.and.results.${team}.json geschrieben`)
			);
			writeFileWithMD5(
				`out/json/${saison}/games.and.results/hfi/${team}.json`,
				JSON.stringify(filteredGamesAndResults, null, 2),
				'utf8',
				() => console.log(`hfi/games.and.results.${team}.json geschrieben`)
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
	  <th align="center">S/U/N</th> 
	  <th align="center"colspan="3">Tore</th>
	  <th align="center" colspan="3">Punkte</th>
	</tr>`;
	for (let row of leaderboard) {
		html += `<tr>
		<td align="center">${row.platz}</td>
		<td align="left">${row.name.replace(
			'SG JSG HF Illtal - HSG Dudweiler-Fischbach',
			'JSG HF Illtal'
		)}</td>
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
		<td align="left">${row.heim.replace(
			'SG JSG HF Illtal - HSG Dudweiler-Fischbach',
			'JSG HF Illtal'
		)}</td>
		<td align="left">${row.gast.replace(
			'SG JSG HF Illtal - HSG Dudweiler-Fischbach',
			'JSG HF Illtal'
		)}</td>
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
