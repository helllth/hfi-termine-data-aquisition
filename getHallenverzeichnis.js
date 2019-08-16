import fetch from 'node-fetch';
import convert from 'xml-js';
//import _ from 'lodash';
import fs from 'fs-extra';
import md5 from 'md5';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import csv from 'csvtojson';
import iconv from 'iconv-lite';

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};

console.log('started');
fs.ensureDirSync('out/json');

getHallenlisten();

//msg=210032

// function writeTable(name, csvdata) {
// 	fs.writeFile(`out/${name}.csv`, csvdata, 'utf8', () => console.log(`${name}.csv geschrieben`));
// }

function pad(n) {
	return n < 10 ? '0' + n : n;
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

async function getHallenlisten() {
	const url = 'https://spo.handball4all.de/Spielbetrieb/hallenliste.php';
	let fd = new FormData();
	// 'm=16' -F 'nm=0' -F 'clubno=210032' -F 'lgym=1' -F 'own=1' -F 'onefile=1' -F
	// 'hvwsubmit=dw'

	fd.append('sort', 0);
	fd.append('types', 0);
	fd.append('hvwsubmit', 'gl_save');
	fd.append('submit', 'Liste heruntreladen');
	fd.append('hvw_DW_flag', 1);

	const response = await fetch(url, {
		method: 'post',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
		},
		body: fd
	});
	let arrayBuffer = await response.arrayBuffer();
	let txt = iconv.decode(new Buffer(arrayBuffer), 'iso-8859-15').toString();

	const jsonObj = await csv({ noheader: false, delimiter: ';' }).fromString(txt);
	fs.writeFile(`out/json/hallenverzeichnis.json`, JSON.stringify(jsonObj, null, 2), 'utf8', () =>
		console.log(`out/json/hallenverzeichnis.json geschrieben`)
	);
	//	console.log('jsonObj', jsonObj);

	// var zip = new AdmZip(buffer);
	// var zipEntries = zip.getEntries();
	// for (var i = 0; i < zipEntries.length; i++) {
	// 	const txt = csvHeader + '\n' + zip.readAsText(zipEntries[i], 'binary');

	// 	const jsonObj = await csv({ noheader: false, delimiter: ';' }).fromString(txt);
	// 	//console.log('JSON', jsonObj);
	// 	for (let entry of jsonObj) {
	// 		// try {
	// 		const day = entry.Datum.substr(0, 2);
	// 		const month = entry.Datum.substr(3, 2);
	// 		const year = '20' + entry.Datum.substr(6, 2);
	// 		var hour = entry.Zeit.substr(0, 2);
	// 		var minute = entry.Zeit.substr(3, 2);
	// 		entry.ts = new Date(year, month - 1, day, hour, minute).toLocaleString('de-DE', {
	// 			timeZone: 'Europe/Berlin'
	// 		});
	// 		// } catch (e) { console.log('fehler', e); console.log('in ', entry); }
	// 	}
	// 	return jsonObj;
	// }
}
