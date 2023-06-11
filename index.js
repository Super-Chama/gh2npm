const express = require('express');
const tt = require('tar-transform');
const fetch = require('node-fetch');

const app = express();

// valid url
// http://localhost:3000/{author}/{repo}
// http://localhost:3000/{author}/{repo}/{folder}
// http://localhost:3000/{author}/{repo}?branch={branch}
// http://localhost:3000/{author}/{repo}?commit={commit}
// http://localhost:3000/{author}/{repo}/{folder}?branch={branch}
// http://localhost:3000/{author}/{repo}/{folder}?commit={commit}

app.get('/:author/:repo/:folder?', async (req, res) => {
	const { author, repo, folder } = req.params;
	const { commit, branch } = req.query;

	const ref = commit || branch || 'main';

	if (!author || !repo || !ref) {
		return res.status(400).send('Bad url format!');
	}

	const outputName = `${[author, repo, folder || '', ref].filter(Boolean).join('-')}.tgz`;

	try {
		const url = `https://codeload.github.com/${author}/${repo}/tar.gz/${ref}`;

		const tgzStream = (await fetch(url)).body;

		const extractStream = tt.extract({
			gzip: true,
		});

		const transformStream = tt.transform({
			onEntry(entry) {
				const file = entry.headers.name.replace(/^[^\/]*./, ''); // strip the hash

				if (folder) {
					const fileName = file.match(/^[^\/]*/);
					if (!fileName || fileName.length === 0 || fileName[0] !== folder) {
						return this.pass(entry);
					}
				}

				const headers = this.util.headersWithNewName(entry.headers, 'package/' + file.replace(/^[^\/]*./, ''));

				this.push({ ...entry, headers });
			},
		});

		// repack to tgz
		const packStream = tt.pack({ gzip: true });

		res.set('Content-Disposition', `attachment; filename="${outputName}"`);
		res.set('Content-Type', 'application/gzip');

		tgzStream
			.pipe(extractStream)
			.pipe(transformStream)
			.pipe(packStream)
			.pipe(res)
			.on('error', (error) => {
				throw new Error(error);
			});
	} catch (error) {
		console.error('An error occurred:', error);
		res.status(500).send('An error occurred while processing the tarball.');
	}
});

app.listen(3000, () => {
	console.log('Server listening on port 3000');
});
