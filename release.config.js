export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        writerOpts: {
          transform(commit, _context, options) {
            const coAuthorPattern = /^Co-Authored-By:.*$/gim

            const patch = {
              hash: typeof commit.hash === 'string' ? commit.hash.substring(0, 7) : commit.hash,
              header: typeof commit.header === 'string' ? commit.header.substring(0, 100) : commit.header,
              committerDate: commit.committerDate ? options.formatDate(commit.committerDate) : commit.committerDate,
            }

            if (typeof commit.footer === 'string') {
              const cleaned = commit.footer.replace(coAuthorPattern, '').replace(/\n{2,}/g, '\n').trim()
              patch.footer = cleaned || null
            }

            if (typeof commit.body === 'string') {
              const cleaned = commit.body.replace(coAuthorPattern, '').replace(/\n{2,}/g, '\n').trim()
              patch.body = cleaned || null
            }

            return patch
          },
        },
      },
    ],
    [
      '@semantic-release/changelog',
      { changelogFile: 'CHANGELOG.md' },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
}
