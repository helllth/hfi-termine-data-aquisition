import fs from 'fs-extra';
import md5 from 'md5';
() => console.log(`leaderboard.${team}.json geschrieben`);
export const writeFileWithMD5 = (
	name,
	data,
	encoding = 'utf8',
	finished = () => console.log(`${name} geschrieben`)
) => {
	fs.writeFileSync(name + '.md5', md5(data), { encoding });
	fs.writeFileSync(name, data, { encoding });
	finished();
};
