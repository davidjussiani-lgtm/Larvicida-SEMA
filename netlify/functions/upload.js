// Environment variables required:
// GITHUB_TOKEN: personal access token (repo scope)
// REPO_OWNER: repository owner (e.g. davidjussiani-lgtm)
// REPO_NAME: repository name (e.g. Larvicida-SEMA)
// BRANCH: branch to commit to (default: main)
// TARGET_PATH: path inside repo to place uploads (default: uploads)

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  let body
  try { body = JSON.parse(event.body) } catch (e) { return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) } }
  const { filename, content, commitMessage } = body
  if (!filename || !content) return { statusCode: 400, body: JSON.stringify({ message: 'filename and content required' }) }

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.REPO_OWNER
  const repo = process.env.REPO_NAME
  const branch = process.env.BRANCH || 'main'
  const targetPath = (process.env.TARGET_PATH || 'uploads').replace(/^\/+|\/+$/g, '')

  if (!token || !owner || !repo) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server not configured (missing GITHUB_TOKEN/REPO_OWNER/REPO_NAME)' }) }
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath + '/' + filename)}`

  // Check if file exists to get sha
  let sha = null
  try {
    const getRes = await fetch(apiBase + `?ref=${branch}`, { headers: { Authorization: `token ${token}`, 'User-Agent': 'upload-function' } })
    if (getRes.status === 200) {
      const getJson = await getRes.json()
      sha = getJson.sha
    }
  } catch (e) {
    // ignore
  }

  const payload = {
    message: commitMessage || `Upload ${filename}`,
    content: content,
    branch: branch,
  }
  if (sha) payload.sha = sha

  try {
    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'upload-function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const putJson = await putRes.json()
    if (!putRes.ok) {
      return { statusCode: putRes.status, body: JSON.stringify(putJson) }
    }
    return { statusCode: 200, body: JSON.stringify({ message: 'File uploaded', result: putJson }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: e.message }) }
  }
}
