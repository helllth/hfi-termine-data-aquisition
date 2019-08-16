import fs from 'fs-extra';
import md5 from 'md5';

export const writeFileWithMD5 = (name, data, encoding, finished) => {
	fs.writeFile(name, data, encoding, finished);
	fs.writeFile(name + '.md5', md5(data), encoding, () => {});
};
