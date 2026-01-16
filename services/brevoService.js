import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3'

function getBrevoApiKey() {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada nas variáveis de ambiente')
  }
  return apiKey
}

/**
 * Send e-book email with PDF attachment using Brevo template
 */
export async function sendEbookEmail({ name, email, phone }) {
  try {
    // Get domain for file link
    const domain = process.env.DOMAIN || 'https://www.bethmirage.com'
    const fileLink = `${domain}/media/ebook.pdf`
    
    // Read PDF file
    // Try multiple paths for different environments (Vercel, local, etc.)
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/media/ebook.pdf'),
      path.resolve(process.cwd(), 'media/ebook.pdf'),
      path.resolve(__dirname, '../', process.env.EBOOK_PDF_PATH || './ebooks/nas-garras-de-beth-mirage.pdf'),
      path.resolve(__dirname, '../../media/ebook.pdf'),
      path.resolve(__dirname, '../../frontend/public/media/ebook.pdf'),
      path.resolve(__dirname, '../../frontend/media/ebook.pdf')
    ]
    
    let pdfPath = null
    let pdfBase64 = null
    
    // Try to read from filesystem first
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        pdfPath = possiblePath
        break
      }
    }
    
    // If found on filesystem, read it
    if (pdfPath) {
      const pdfContent = fs.readFileSync(pdfPath)
      pdfBase64 = pdfContent.toString('base64')
    } else {
      // Fallback: fetch PDF from public URL (for Vercel serverless functions)
      console.log('PDF not found on filesystem, fetching from URL:', fileLink)
      try {
        const response = await fetch(fileLink)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF from URL: ${response.status} ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        pdfBase64 = buffer.toString('base64')
        console.log('✅ PDF fetched successfully from URL')
      } catch (fetchError) {
        throw new Error(`PDF file not found on filesystem and could not fetch from URL (${fileLink}): ${fetchError.message}. Tried paths: ${possiblePaths.join(', ')}`)
      }
    }
    
    // Platform link (if you have one, otherwise use contact email)
    const platformLink = process.env.PLATFORM_LINK || `${domain}`

    // Prepare email data using Brevo template
    const emailData = {
      sender: {
        name: process.env.FROM_NAME || 'Beth Mirage',
        email: process.env.FROM_EMAIL || 'noreply@bethmirage.com'
      },
      to: [{
        email: email,
        name: name
      }],
      replyTo: {
        email: process.env.REPLY_TO_EMAIL || 'contato@bethmirage.com'
      },
      templateId: parseInt(process.env.BREVO_TEMPLATE_ID || '0'),
      params: {
        LEAD_NAME: name,
        EBOOK_NAME: 'Nas Garras de Beth Mirage',
        FILE_LINK: fileLink,
        PLATFORM_LINK: platformLink
      },
      // Attach PDF
      attachment: [{
        name: 'Nas-Garras-de-Beth-Mirage.pdf',
        content: pdfBase64
      }]
    }

    // Send email via Brevo API
    const apiKey = getBrevoApiKey()
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log('✅ E-book email sent successfully:', result.messageId)
    return result
  } catch (error) {
    console.error('❌ Error sending e-book email:', error)
    throw error
  }
}

/**
 * Send confirmation email for story submission
 */
export async function sendStoryConfirmation({ email, identificationType }) {
  try {
    const emailData = {
      sender: {
        name: process.env.FROM_NAME || 'Beth Mirage',
        email: process.env.FROM_EMAIL || 'noreply@bethmirage.com.br'
      },
      to: [{
        email: email
      }],
      replyTo: {
        email: process.env.REPLY_TO_EMAIL || 'contato@bethmirage.com.br'
      },
      subject: 'Recebemos seu relato - Beth Mirage'
    }

    const anonymityText = identificationType === 'anonymous' 
      ? 'Seu relato foi recebido de forma completamente anônima.'
      : identificationType === 'pseudonym'
      ? 'Seu relato foi recebido com pseudônimo.'
      : 'Obrigado por compartilhar seu relato conosco.'

    emailData.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          h1 {
            color: #000000;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            margin-bottom: 15px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Obrigado por compartilhar sua voz</h1>
          <p>${anonymityText}</p>
          <p>Seu relato é importante e ajuda outras pessoas a entenderem que não estão sozinhas nesta luta.</p>
          <p>Se você precisar de apoio adicional, não hesite em nos contatar.</p>
          <div class="footer">
            <p>Beth Mirage - A Ilusão que Mata a Alma</p>
            <p>Este é um email automático. Por favor, não responda diretamente.</p>
          </div>
        </div>
      </body>
      </html>
    `

    emailData.textContent = `
Obrigado por compartilhar sua voz

${anonymityText}

Seu relato é importante e ajuda outras pessoas a entenderem que não estão sozinhas nesta luta.

Se você precisar de apoio adicional, não hesite em nos contatar.

---
Beth Mirage - A Ilusão que Mata a Alma
Este é um email automático. Por favor, não responda diretamente.
    `

    // Send email via Brevo API
    const apiKey = getBrevoApiKey()
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log('✅ Story confirmation email sent successfully:', result.messageId)
    return result
  } catch (error) {
    console.error('❌ Error sending story confirmation email:', error)
    throw error
  }
}
