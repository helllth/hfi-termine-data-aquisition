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

String.prototype.replaceAll = function (search, replacement) {
				var target = this;
				return target
								.split(search)
								.join(replacement);
};

console.log('started');
let today = new Date();
console.log('today.getDay', today.getDay());

if (today.getDay() === 0) {
				today.setDate(today.getDate() - 1);
}
today.setHours(0);
today.setMinutes(0);

let nextSunday = endOfWeek(today);
let lastMonday = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate() - 6);
let nextMonday = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate() + 1);
let nextButOneSunday = endOfWeek(nextSunday);
let nextButOneMonday = new Date(nextButOneSunday.getFullYear(), nextButOneSunday.getMonth(), nextButOneSunday.getDate() + 1);

console.log('today', today + '');
console.log('lastMonday', lastMonday + '');
console.log('nextSunday', nextSunday + '');
console.log('nextButOneSunday', nextButOneSunday + '');

const saison = '18/19';

let seed = {
				hfi1: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34630&nm=12&' +
												'teamID=437815',
				hfi2: 'http://spo.handball4all.de/Spielbetrieb/?orgGrpID=80&score=34939&teamID=440182',
				hfi3: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34942&nm=12&' +
												'teamID=440212',
				hfi4: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34984&nm=12&' +
												'teamID=458383',
				a: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=34636&nm=12&' +
												'teamID=441694',
				a2: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36424&nm=12&' +
												'teamID=455953',
				b: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=36436&nm=12&' +
												'teamID=456028',
				d: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38980&nm=12&' +
												'teamID=481123',
				e: 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38983&nm=12&' +
												'teamID=481135'
				// f:
				// 'http://spo.handball4all.de/Spielbetrieb/index.php?orgGrpID=80&score=38983&nm
				// = 12&teamID=481135'
};

let promises = [];

Object
				.keys(seed)
				.forEach(function (k) {
								promises.push(getHtmlForUrl(k, seed[k]));
				});

//let jsg = getGamesForTeam(210047);

Promise
				.all(promises)
				.then((values) => {
								for (const el of values) {
												const $ = cheerio.load(el.html);
												$('.scoretable')
																.find('a')
																.each((i, item) => {
																				item.tagName = 'b';
																});
												el.scoretable = '<table>' + $('.scoretable').html() + '</table>';
												el.gametable = '<table>' + $('.gametable').html() + '</table>';

												el
																.scoretable
																.replace(/<a href=".*">/, '<b>');
												el
																.scoretable
																.replace(/<\/a>/, '</b>');

												//Alle Tabellen schreiben
												fs.writeFile(`out/scoretable.${el.key}.html`, el.scoretable, 'utf8', () => console.log(`scoretable.${el.key}.html geschrieben`));
												let headings = [
																'Platz',
																'Mannschaft',
																'Spiele',
																'Siege',
																'Unentschieden',
																'Niederlagen',
																'Tore+',
																':t:',
																'Tore-',
																'Punkte+',
																':p:',
																'Punkte-'
												];
												fs.writeFile(`out/scoretable.${el.key}.json`, JSON.stringify(tabletojson.convert(el.scoretable, {
																useFirstRowForHeadings: true,
																stripHtmlFromCells: true,
																forceIndexAsNumber: true
												}), null, 2), 'utf8', () => console.log(`scoretable.${el.key}.json geschrieben`));

												//Alle Spiellisten schreiben
												fs.writeFile(`out/gametable.${el.key}.html`, el.gametable, 'utf8', () => console.log(`gametable.${el.key}.html geschrieben`));
												fs.writeFile(`out/gametable.${el.key}.json`, JSON.stringify(tabletojson.convert(el.gametable, {
																useFirstRowForHeadings: true,
																stripHtmlFromCells: false,
																forceIndexAsNumber: true
												}), null, 2), 'utf8', () => console.log(`gametable.${el.key}.json geschrieben`));
								}
				});

function pad(n) {
				return n < 10
								? '0' + n
								: n;
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
				const charsToEnhanceWithSpaces = ['/', '-'];
				for (const eChar of charsToEnhanceWithSpaces) {
								const parts = word.split(eChar);
								const newParts = parts.map((x) => ' ' + x.trim() + ' ');
								word = newParts.join(eChar);
				}
				return word;
}
function getJSGPrefix(game) {
				return game
								.Staffel
								.substr(0, game.Staffel.indexOf('-'));
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
												'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
																				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
								}
				});

				const html = await response.text();

				return {key: key, html};
}
