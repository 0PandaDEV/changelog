import express, { Request, Response } from 'express'
import { ChangelogGenerator } from './api/changelog'

const app = express()
app.use(express.json())

app.post('/changelog', async (req: Request, res: Response): Promise<void> => {
  try {
    const { githubUrl, options = {} } = req.body

    if (!githubUrl) {
      res.status(400).json({
        error: 'Missing required parameter: githubUrl'
      })
      return
    }

    const generator = new ChangelogGenerator()
    const changelog = await generator.generate({
      githubUrl,
      includeRefIssues: true,
      useGitmojis: true,
      includeInvalidCommits: false,
      reverseOrder: false,
      ...options
    })

    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', 'attachment; filename=CHANGELOG.md')
    res.send(changelog)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
