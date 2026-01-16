import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { sendEbookEmail, sendStoryConfirmation } from './services/brevoService.js'
import { saveStory } from './services/database.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve ebook.pdf with download headers (force download instead of viewing)
app.get('/media/ebook.pdf', (req, res) => {
  const filePath = path.join(__dirname, '../media/ebook.pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="ebook.pdf"')
  res.setHeader('Content-Type', 'application/pdf')
  res.sendFile(filePath)
})

// Serve other static files from media directory (if any)
app.use('/media', express.static(path.join(__dirname, '../media'), {
  setHeaders: (res, filePath) => {
    // Force download for PDF files
    if (path.extname(filePath) === '.pdf') {
      res.setHeader('Content-Disposition', 'attachment')
    }
  }
}))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' })
})

// Subscribe and send e-book
app.post('/api/subscribe', async (req, res) => {
  try {
    console.log("starting subscribe");
    const { name, email, phone, consent } = req.body
    console.log('req.body', req.body);
    // Validation
    if (!email || !name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e telefone são obrigatórios'
      })
    }

    console.log('name', name);

    if (!consent) {
      return res.status(400).json({
        success: false,
        message: 'É necessário concordar com os termos para receber o e-book'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      })
    }

    console.log('email', email)

    // Validate phone format (basic validation)
    const phoneRegex = /^[\d\s\(\)\-\+]{10,}$/
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Telefone inválido'
      })
    }

    console.log('phone', phone)

    // Send e-book via Brevo
    await sendEbookEmail({ name, email, phone })

    res.json({
      success: true,
      message: 'E-book enviado com sucesso! Verifique sua caixa de entrada.'
    })
  } catch (error) {
    console.error('Error in /api/subscribe:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao processar solicitação. Por favor, tente novamente.'
    })
  }
})

// Submit story/report
app.post('/api/stories', async (req, res) => {
  try {
    const { identificationType, story, name, pseudonym, email } = req.body

    // Validation
    if (!identificationType || !story) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de identificação e relato são obrigatórios'
      })
    }

    if (story.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'O relato deve ter pelo menos 50 caracteres'
      })
    }

    // Validate identification type requirements
    if (identificationType === 'realName' && !name) {
      return res.status(400).json({
        success: false,
        message: 'Nome é obrigatório quando seleciona "nome real"'
      })
    }

    if (identificationType === 'pseudonym' && !pseudonym) {
      return res.status(400).json({
        success: false,
        message: 'Pseudônimo é obrigatório quando seleciona "pseudônimo"'
      })
    }

    // Prepare story data (respecting anonymity)
    const storyData = {
      identificationType,
      story,
      ...(identificationType === 'realName' && { name }),
      ...(identificationType === 'pseudonym' && { pseudonym }),
      ...(email && { email }),
      submittedAt: new Date().toISOString()
    }

    // Save to database
    await saveStory(storyData)

    // Send confirmation email if email provided
    if (email) {
      try {
        await sendStoryConfirmation({ email, identificationType })
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError)
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Relato enviado com sucesso. Obrigado por compartilhar sua voz.'
    })
  } catch (error) {
    console.error('Error in /api/stories:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao processar relato. Por favor, tente novamente.'
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📧 Brevo email service configured`)
  console.log(`🌐 API available at http://localhost:${PORT}/api`)
  console.log(`📄 E-book available at http://localhost:${PORT}/media/ebook.pdf`)
})
